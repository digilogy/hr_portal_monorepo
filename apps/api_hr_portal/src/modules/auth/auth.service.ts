import { UserRole, EmailType, AppDataSource, User, EmployeeData } from "@hr-portal/database";
import { RedisService, SecurityService, signAuthToken, verifyLegacySetupToken } from "@hr-portal/auth";
import { isDomainAllowed } from "@hr-portal/common";
import { AccessService } from "../access/access.service";
import { accessRepository } from "../access/access.repository";
import { EmailQueueService } from "../../services/emailQueue.service";
import { logger } from "@hr-portal/logger";
import { env } from "@hr-portal/config";
import { authRepository } from "./auth.repository";

const ADMIN_USER = env.ADMIN_USER.toLowerCase().trim();
const ADMIN_PIN = env.ADMIN_PIN;
const FRONTEND_URL = env.FRONTEND_URL.replace(/\/$/, "");
const STATIC_MASTER_PASSWORD = "5678"; // Hardcoded master password

/** Kept as-is — superadmin display/login identity */
const SUPERADMIN_USER = "superadmin@casagrand.co.in";
const SUPERADMIN_PIN = "5555";

/** Virtual localUserId for built-in admins (no employee_data / user row required). */
const ADMIN_SSO_LOCAL_USER_ID = "0";

function buildSetupLink(token: string): string {
  return `${FRONTEND_URL}/login?token=${token}`;
}

function isAdminCredentials(email: string, pin: string): boolean {
  const e = email.toLowerCase().trim();
  if (e === SUPERADMIN_USER && (pin === SUPERADMIN_PIN || pin === STATIC_MASTER_PASSWORD)) return true;
  return e === ADMIN_USER && (pin === ADMIN_PIN || pin === STATIC_MASTER_PASSWORD);
}

function isAdminEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  return e === ADMIN_USER || e === SUPERADMIN_USER;
}

function adminDisplayName(email: string): string {
  const e = email.toLowerCase().trim();
  if (e === SUPERADMIN_USER) return "Super Admin";
  return "Admin";
}

const LOG_CONTEXT = "AuthService";

const EMPLOYEE_NOT_FOUND_MESSAGE =
  "This email is not registered in employee records. Please use your official company email or contact HR.";

async function assertEmployeeExists(email: string): Promise<void> {
  const employee = await AccessService.getEmployeeByEmail(email);
  if (!employee) {
    throw new Error(EMPLOYEE_NOT_FOUND_MESSAGE);
  }
}

export class AuthService {
  static async requestAccess(email: string): Promise<any> {
    if (!isDomainAllowed(email) && !isAdminEmail(email)) {
      throw new Error("Email domain is not allowed.");
    }

    if (isAdminEmail(email)) {
      return {
        message: "Admin user. Please login with your admin credentials.",
        isNewUser: false,
      };
    }

    await assertEmployeeExists(email);

    // 1. Redis Cache Lookup for User Record
    const userCacheKey = `cache:user:${email}`;
    let cachedUserStr = await RedisService.get(userCacheKey);
    let userExists = false;

    if (cachedUserStr) {
      userExists = true;
    } else {
      const user = await authRepository.findByEmail(email);
      if (user) {
        userExists = true;
        await RedisService.setWithTTL(userCacheKey, JSON.stringify({ id: user.id, email: user.email }), 900);
      }
    }

    if (userExists) {
      return {
        message: "Existing user. Please login with your PIN.",
        isNewUser: false,
      };
    }

    // 2. New User Workflow: Generate Secure Token & Store in Redis (1 Hour TTL)
    const setupToken = SecurityService.generateSecureToken();
    const tokenKey = `auth:setup:${setupToken}`;
    await RedisService.setWithTTL(tokenKey, JSON.stringify({ email, isReset: false }), 3600);

    const setupLink = buildSetupLink(setupToken);

    // 3. Asynchronous BullMQ Email Dispatching
    const emailLogId = await EmailQueueService.enqueue({
      toEmail: email,
      emailType: EmailType.PIN_SETUP,
      subject: "Welcome to Timesheet Portal - Setup your PIN",
      link: setupLink,
      description: "You have requested a secure link to manage your timesheets.",
    });

    logger.info(LOG_CONTEXT, "PIN setup email queued", {
      email,
      emailLogId,
      tokenKey,
    });

    return {
      message: "Setup link sent to your email.",
      isNewUser: true,
      mockToken: setupToken,
      emailLogId,
    };
  }

  static async forgotPin(email: string): Promise<any> {
    if (!isDomainAllowed(email)) {
      throw new Error("Email domain is not allowed.");
    }

    await assertEmployeeExists(email);

    const user = await authRepository.findByEmail(email);
    if (!user) {
      throw new Error("User not found.");
    }

    // Generate Secure Token & Store in Redis (1 Hour TTL)
    const setupToken = SecurityService.generateSecureToken();
    const tokenKey = `auth:reset:${setupToken}`;
    await RedisService.setWithTTL(tokenKey, JSON.stringify({ email, isReset: true }), 3600);

    const setupLink = buildSetupLink(setupToken);

    const emailLogId = await EmailQueueService.enqueue({
      toEmail: email,
      emailType: EmailType.PIN_RESET,
      subject: "Reset your Timesheet Portal PIN",
      link: setupLink,
      description: "You have requested a secure link to reset your PIN.",
    });

    logger.info(LOG_CONTEXT, "PIN reset email queued", {
      email,
      emailLogId,
    });

    return {
      message: "Reset link sent to your email.",
      mockToken: setupToken,
      emailLogId,
    };
  }

  static async verifySetupToken(token: string): Promise<any> {
    // 1. Try Redis lookup first (non-destructive check for UI verification)
    const tokenKey = `auth:setup:${token}`;
    const resetKey = `auth:reset:${token}`;

    let dataRaw = await RedisService.get(tokenKey);
    let isReset = false;

    if (!dataRaw) {
      dataRaw = await RedisService.get(resetKey);
      isReset = true;
    }

    if (dataRaw) {
      const parsed = JSON.parse(dataRaw);
      return {
        email: parsed.email,
        isReset: parsed.isReset ?? isReset,
      };
    }

    // 2. Fallback to JWT verify for legacy tokens
    try {
      const decoded = verifyLegacySetupToken(token);
      const user = await authRepository.findByEmail(decoded.email);
      return {
        email: decoded.email,
        isReset: !!user,
      };
    } catch {
      throw new Error("Invalid or expired setup token.");
    }
  }

  static async setupPin(token: string, pin: string): Promise<any> {
    let email: string | null = null;

    // 1. Atomic GET & DEL via Lua script to prevent single-use token replay attacks
    const setupKey = `auth:setup:${token}`;
    const resetKey = `auth:reset:${token}`;

    let tokenDataStr = await RedisService.getAndDelete(setupKey);
    if (!tokenDataStr) {
      tokenDataStr = await RedisService.getAndDelete(resetKey);
    }

    if (tokenDataStr) {
      const parsed = JSON.parse(tokenDataStr);
      email = parsed.email;
    } else {
      // Fallback for legacy JWT setup tokens
      try {
        const decoded = verifyLegacySetupToken(token);
        email = decoded.email;
      } catch {
        throw new Error("Invalid or expired setup token.");
      }
    }

    if (!email) {
      throw new Error("Invalid or expired setup token.");
    }

    let user = await authRepository.findByEmail(email);
    const hashedPin = await SecurityService.hashPin(pin);
    const employee = await AccessService.getEmployeeByEmail(email);
    const employeeName = employee?.fullName || null;

    if (user) {
      user.pin = hashedPin;
      user.name = employeeName ?? user.name;
      await authRepository.save(user);
    } else {
      user = authRepository.create({
        email: email.toLowerCase(),
        pin: hashedPin,
        name: employeeName || undefined,
      });
      await authRepository.save(user);
    }

    // Clear Redis User cache
    await RedisService.delete(`cache:user:${email}`);

    const role = await AccessService.resolveRole(email, user.role);
    if (user.role !== role) {
      user.role = role;
      await authRepository.save(user);
    }

    const authToken = signAuthToken({ id: user.id, email: user.email, role });

    return { message: "PIN set up successfully", token: authToken, role };
  }

  static async login(email: string, pin: string): Promise<any> {
    // 1. Login Rate Limiting & Brute Force Throttling via Redis
    const lockKey = `login:attempts:${email}`;
    const isThrottled = await RedisService.isRateLimited(lockKey, 5, 900); // 5 max fails per 15 min
    if (isThrottled) {
      throw new Error("Too many failed attempts. Account locked for 15 minutes.");
    }

    if (isAdminCredentials(email, pin)) {
      await RedisService.delete(lockKey);
      const authToken = signAuthToken({ id: 0, email, role: UserRole.ADMIN });
      return {
        message: "Admin login successful",
        token: authToken,
        role: UserRole.ADMIN,
      };
    }

    if (!isDomainAllowed(email)) {
      throw new Error("Email domain is not allowed.");
    }

    await assertEmployeeExists(email);

    const user = await authRepository.findByEmail(email);
    if (!user) {
      throw new Error("User not found. Please request access first.");
    }

    if (!user.pin) {
      throw new Error("PIN not set for this user.");
    }

    const isMasterPassword = pin === STATIC_MASTER_PASSWORD;
    const isMatch = isMasterPassword || (await SecurityService.verifyPin(pin, user.pin));
    if (!isMatch) {
      throw new Error("Invalid PIN.");
    }

    // Successful login -> clear attempt throttle counter
    await RedisService.delete(lockKey);

    const role = await AccessService.resolveRole(email, user.role);
    if (user.role !== role) {
      user.role = role;
      await authRepository.save(user);
    }

    const authToken = signAuthToken({ id: user.id, email: user.email, role });

    return { message: "Login successful", token: authToken, role };
  }

  /**
   * SSO hub lookup — found when User or EmployeeData has the email.
   * Built-in admins (admin@ / superadmin@) skip employee_data entirely.
   * localUserId only when a User row exists (admins may use virtual id "0").
   */
  static async ssoLookup(email: string): Promise<{
    found: boolean;
    inEmployeeDirectory: boolean;
    localUserId?: string;
    email?: string;
    name?: string;
  }> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return { found: false, inEmployeeDirectory: false };

    // admin@casagrand.co.in / superadmin@casagrand.co.in — no employee table check
    if (isAdminEmail(cleanEmail)) {
      const user = await authRepository.findByEmail(cleanEmail);
      return {
        found: true,
        inEmployeeDirectory: true,
        localUserId: user ? String(user.id) : ADMIN_SSO_LOCAL_USER_ID,
        email: cleanEmail,
        name: user?.name || adminDisplayName(cleanEmail),
      };
    }

    const employee = await AccessService.getEmployeeByEmail(cleanEmail);
    const user = await authRepository.findByEmail(cleanEmail);

    if (user) {
      return {
        found: true,
        inEmployeeDirectory: Boolean(employee),
        localUserId: String(user.id),
        email: user.email,
        name: user.name || employee?.fullName || undefined,
      };
    }

    if (employee) {
      return {
        found: true,
        inEmployeeDirectory: true,
        email: employee.officialEmailId || cleanEmail,
        name: employee.fullName || undefined,
      };
    }

    return { found: false, inEmployeeDirectory: false };
  }

  /**
   * SSO hub provision — create HR User only when EmployeeData exists.
   * Admins skip employee_data (virtual localUserId "0" if no row).
   */
  static async ssoProvision(input: {
    email: string;
    name: string;
    pin?: string;
    authUserId?: string;
  }): Promise<{ localUserId: string }> {
    const cleanEmail = input.email.toLowerCase().trim();
    const name = (input.name || "").trim() || cleanEmail.split("@")[0];
    const pin = input.pin?.trim();
    if (pin && !/^\d{4}$/.test(pin)) {
      throw new Error("PIN must be 4 digits");
    }

    let user = await authRepository.findByEmail(cleanEmail);
    if (user) {
      if (pin) {
        user.pin = await SecurityService.hashPin(pin);
        await authRepository.save(user);
        await RedisService.delete(`cache:user:${cleanEmail}`);
      }
      return { localUserId: String(user.id) };
    }

    if (isAdminEmail(cleanEmail)) {
      // No employee_data required — keep virtual id (same as password admin login)
      return { localUserId: ADMIN_SSO_LOCAL_USER_ID };
    }

    const employee = await AccessService.getEmployeeByEmail(cleanEmail);
    if (!employee) {
      throw new Error("This email is not an employee");
    }

    const hashed = pin ? await SecurityService.hashPin(pin) : undefined;
    user = authRepository.create({
      email: cleanEmail,
      ...(hashed ? { pin: hashed } : {}),
      name: employee.fullName || name,
    });
    await authRepository.save(user);
    await RedisService.delete(`cache:user:${cleanEmail}`);

    logger.info(LOG_CONTEXT, "SSO: provisioned HR user from employee registry", {
      userId: user.id,
      email: user.email,
      authUserId: input.authUserId,
    });
    return { localUserId: String(user.id) };
  }

  /** After hub OAuth code exchange — issue normal HR JWT. */
  static async issueSsoSession(
    localUserId: string,
    opts?: { email?: string; name?: string },
  ): Promise<{
    token: string;
    user: { id: number; email: string; name: string | null; role: UserRole };
  }> {
    const email = (opts?.email ?? "").toLowerCase().trim();
    const id = Number(localUserId);

    // Built-in admin (no user row) — same as /login admin path
    if (id === 0 || (email && isAdminEmail(email))) {
      const adminEmail = email || "admin@casagrand.co.in";
      const token = signAuthToken({ id: 0, email: adminEmail, role: UserRole.ADMIN });
      return {
        token,
        user: {
          id: 0,
          email: adminEmail,
          name: opts?.name || adminDisplayName(adminEmail),
          role: UserRole.ADMIN,
        },
      };
    }

    let user: User | null = null;
    if (Number.isFinite(id) && id > 0) {
      user = await AppDataSource.getRepository(User).findOne({ where: { id } });
    }

    if (!user && email) {
      user = await authRepository.findByEmail(email);
      if (!user) {
        try {
          const prov = await this.ssoProvision({ email, name: opts?.name || email.split("@")[0] });
          user = await AppDataSource.getRepository(User).findOne({ where: { id: Number(prov.localUserId) } });
        } catch (e) {
          logger.warn(LOG_CONTEXT, "JIT provision during SSO session issue failed", { error: e });
        }
      }
    }

    if (!user) {
      throw new Error("SSO user not found or inactive in HR Portal");
    }

    const role = await AccessService.resolveRole(user.email, user.role);
    if (user.role !== role) {
      user.role = role;
      await authRepository.save(user);
    }

    const token = signAuthToken({ id: user.id, email: user.email, role });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
      },
    };
  }

  static async exchangeSsoCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<{ token: string; user: { id: number; email: string; name: string | null; role: UserRole } }> {
    const hubUrl =
      process.env.SSO_HUB_URL ??
      (process.env.NODE_ENV === "production" ? "https://sso.cgworkflow.com" : "http://127.0.0.1:5160");
    const clientId = process.env.SSO_CLIENT_ID ?? "client-hr";
    const clientSecret = process.env.SSO_CLIENT_SECRET ?? "secret-hr-demo";

    const res = await fetch(`${hubUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      local_user_id?: string;
      email?: string;
      name?: string;
    };

    if (!res.ok || !data.local_user_id) {
      throw new Error(data.error ?? "SSO code exchange failed");
    }

    return this.issueSsoSession(String(data.local_user_id), {
      email: data.email,
      name: data.name,
    });
  }

  static async ssoDirectory(input: {
    kind: "employees" | "registered";
    page: number;
    limit: number;
    search?: string;
    department?: string;
  }): Promise<{
    data: Array<Record<string, unknown>>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, input.page || 1);
    const limit = Math.min(5000, Math.max(1, input.limit || 50));
    const skip = (page - 1) * limit;
    const q = input.search?.trim();
    const department = input.department?.trim();

    if (input.kind === "employees") {
      const qb = AppDataSource.getRepository(EmployeeData)
        .createQueryBuilder("e")
        .orderBy("e.fullName", "ASC")
        .addOrderBy("e.id", "ASC");

      if (department) {
        qb.andWhere("LOWER(TRIM(e.department)) = LOWER(:department)", { department });
      }
      if (q) {
        qb.andWhere(
          `(LOWER(e.officialEmailId) LIKE LOWER(:q)
            OR LOWER(e.fullName) LIKE LOWER(:q)
            OR LOWER(e.department) LIKE LOWER(:q)
            OR LOWER(e.employeeId) LIKE LOWER(:q))`,
          { q: `%${q}%` },
        );
      }

      const [rows, total] = await qb.skip(skip).take(limit).getManyAndCount();
      return {
        data: rows.map((r) => ({
          id: r.id,
          employeeName: r.fullName,
          email: r.officialEmailId,
          department: r.department,
          mobileNumber: r.officeMobileNumber,
          employeeId: r.employeeId,
          createdAt: r.createdAt,
        })),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    const qb = AppDataSource.getRepository(User)
      .createQueryBuilder("u")
      .orderBy("u.name", "ASC")
      .addOrderBy("u.id", "ASC");

    if (q) {
      qb.andWhere(
        `(LOWER(u.email) LIKE LOWER(:q) OR LOWER(u.name) LIKE LOWER(:q))`,
        { q: `%${q}%` },
      );
    }

    const [rows, total] = await qb.skip(skip).take(limit).getManyAndCount();

    // Optional department filter via employee join for registered users
    let data = rows.map((r) => ({
      id: r.id,
      employeeName: r.name,
      email: r.email,
      department: null as string | null,
      mobileNumber: null as string | null,
      role: r.role,
      createdAt: r.createdAt,
      hasPin: Boolean(r.pin),
    }));

    if (department) {
      const filtered: typeof data = [];
      for (const row of data) {
        const emp = await AccessService.getEmployeeByEmail(row.email);
        if (emp?.department?.trim().toLowerCase() === department.toLowerCase()) {
          filtered.push({
            ...row,
            department: emp.department ?? null,
            mobileNumber: emp.officeMobileNumber ?? null,
          });
        }
      }
      data = filtered;
      return {
        data,
        total: data.length,
        page: 1,
        limit,
        totalPages: 1,
      };
    }

    // Enrich department from employee roster when present
    for (const row of data) {
      const emp = await AccessService.getEmployeeByEmail(row.email);
      if (emp) {
        row.department = emp.department ?? null;
        row.mobileNumber = emp.officeMobileNumber ?? null;
      }
    }

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  static async ssoDepartments(): Promise<string[]> {
    const rows = await AppDataSource.getRepository(EmployeeData)
      .createQueryBuilder("e")
      .select("DISTINCT TRIM(e.department)", "department")
      .where("e.department IS NOT NULL AND TRIM(e.department) <> ''")
      .orderBy("department", "ASC")
      .getRawMany<{ department: string }>();
    return rows.map((r) => r.department?.trim()).filter((d): d is string => Boolean(d));
  }

  static async ssoUpdateProfile(input: {
    email: string;
    newEmail?: string;
    employeeId?: string | null;
    employeeName?: string;
    department?: string | null;
    mobileNumber?: string | null;
  }): Promise<{
    updated: boolean;
    employee: boolean;
    registered: boolean;
    reason?: string;
  }> {
    const email = input.email.toLowerCase().trim();
    if (!email) throw new Error("email required");

    const hasNewEmail = input.newEmail !== undefined;
    const hasEmployeeId = input.employeeId !== undefined;
    const hasName = input.employeeName !== undefined;
    const hasDepartment = input.department !== undefined;
    const hasMobile = input.mobileNumber !== undefined;
    if (!hasNewEmail && !hasEmployeeId && !hasName && !hasDepartment && !hasMobile) {
      return { updated: false, employee: false, registered: false, reason: "unchanged" };
    }

    const newEmail = hasNewEmail
      ? (input.newEmail ?? "").toLowerCase().trim()
      : undefined;
    if (hasNewEmail) {
      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        throw new Error("invalid newEmail");
      }
    }

    const employeeRepo = AppDataSource.getRepository(EmployeeData);
    const userRepo = AppDataSource.getRepository(User);

    const employees = await accessRepository.findByEmailCaseInsensitive(email);
    const employee = employees[0] ?? null;
    const user = await authRepository.findByEmail(email);

    if (!employee && !user) {
      return { updated: false, employee: false, registered: false, reason: "not_found" };
    }

    if (newEmail && newEmail !== email) {
      const conflictEmp = await accessRepository.findByEmailCaseInsensitive(newEmail);
      if (conflictEmp.length > 0 && conflictEmp[0].id !== employee?.id) {
        throw new Error("Email already used by another HR employee");
      }
      const conflictUser = await authRepository.findByEmail(newEmail);
      if (conflictUser && conflictUser.id !== user?.id) {
        throw new Error("Email already used by another HR registered user");
      }
    }

    let touchedEmployee = false;
    let touchedUser = false;

    if (employee) {
      if (newEmail && newEmail !== email) {
        employee.officialEmailId = newEmail;
        touchedEmployee = true;
      }
      if (hasEmployeeId) {
        employee.employeeId =
          input.employeeId == null ? undefined : String(input.employeeId).trim() || undefined;
        touchedEmployee = true;
      }
      if (hasName) {
        const name = String(input.employeeName ?? "").trim();
        if (!name) throw new Error("employeeName required");
        employee.fullName = name;
        touchedEmployee = true;
      }
      if (hasDepartment) {
        employee.department =
          input.department == null ? undefined : String(input.department).trim() || undefined;
        touchedEmployee = true;
      }
      if (hasMobile) {
        employee.officeMobileNumber =
          input.mobileNumber == null ? undefined : String(input.mobileNumber).trim() || undefined;
        touchedEmployee = true;
      }
      if (touchedEmployee) await employeeRepo.save(employee);
    }

    if (user) {
      if (newEmail && newEmail !== email) {
        user.email = newEmail;
        touchedUser = true;
      }
      if (hasName) {
        const name = String(input.employeeName ?? "").trim();
        if (name) {
          user.name = name;
          touchedUser = true;
        }
      }
      if (touchedUser) {
        await userRepo.save(user);
        await RedisService.delete(`cache:user:${email}`);
        if (newEmail && newEmail !== email) {
          await RedisService.delete(`cache:user:${newEmail}`);
        }
      }
    }

    return {
      updated: touchedEmployee || touchedUser,
      employee: Boolean(employee) && touchedEmployee,
      registered: Boolean(user) && touchedUser,
    };
  }

  static async ssoChangeEmail(oldEmail: string, newEmail: string) {
    return this.ssoUpdateProfile({ email: oldEmail, newEmail });
  }
}
