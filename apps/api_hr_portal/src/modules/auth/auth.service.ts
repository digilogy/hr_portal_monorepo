import { UserRole, EmailType } from "@hr-portal/database";
import { RedisService, SecurityService, signAuthToken, verifyLegacySetupToken } from "@hr-portal/auth";
import { isDomainAllowed } from "@hr-portal/common";
import { AccessService } from "../access/access.service";
import { EmailQueueService } from "../../services/emailQueue.service";
import { logger } from "@hr-portal/logger";
import { env } from "@hr-portal/config";
import { authRepository } from "./auth.repository";

const ADMIN_USER = env.ADMIN_USER;
const ADMIN_PIN = env.ADMIN_PIN;
const FRONTEND_URL = env.FRONTEND_URL.replace(/\/$/, "");

function buildSetupLink(token: string): string {
  return `${FRONTEND_URL}/login?token=${token}`;
}

function isAdminCredentials(email: string, pin: string): boolean {
  return email === ADMIN_USER && pin === ADMIN_PIN;
}

function isAdminEmail(email: string): boolean {
  return email === ADMIN_USER;
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

    if (user) {
      user.pin = hashedPin;
      await authRepository.save(user);
    } else {
      user = authRepository.create({
        email,
        pin: hashedPin,
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

    const isMatch = await SecurityService.verifyPin(pin, user.pin);
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
}
