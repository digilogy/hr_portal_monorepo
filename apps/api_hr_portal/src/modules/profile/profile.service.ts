import { UserRole, AppDataSource, EmployeeShiftAssignment, EmployeeData } from "@hr-portal/database";
import { AccessService } from "../access/access.service";
import { profileRepository } from "./profile.repository";
import { holidayRepository } from "../admin/holiday.repository";
import { RedisService } from "@hr-portal/auth";

export interface EmployeeProfile {
  name: string;
  employeeId: string;
  reportingManager: string;
  hod: string;
  department: string;
  email: string;
  phone: string;
  jobTitle: string;
  employmentStatus: string;
  subDepartment: string;
  role: UserRole;
  alsoManager: boolean;
  policy?: string;
  weeklyOff?: string;
  shiftName?: string;
  allowedTimings?: string;
  preferredTiming?: string;
  halfDay?: string;
  zone?: string;
  mappedZone?: string;
  upcomingHolidays?: any[];
}

function formatValue(value?: string | null): string {
  return value?.trim() || "—";
}

export class ProfileService {
  private static profilePromiseCache = new Map<string, Promise<EmployeeProfile | null>>();

  static async getProfileByEmail(
    email: string,
  ): Promise<EmployeeProfile | null> {
    const cacheKey = `profile_v2:${email.toLowerCase()}`;
    
    if (this.profilePromiseCache.has(cacheKey)) {
      return this.profilePromiseCache.get(cacheKey)!;
    }

    const computePromise = (async () => {
      const cachedProfile = await RedisService.get(cacheKey);
      if (cachedProfile) {
        try {
          return JSON.parse(cachedProfile);
        } catch (e) {
          // ignore JSON parse error
        }
      }

    const employee = await profileRepository.findByEmail(email);

    if (!employee) {
      if (AccessService.isAdminEmail(email)) {
        const adminProfile = {
          name: "Admin",
          employeeId: "—",
          reportingManager: "—",
          hod: "—",
          department: "HR / Admin",
          email,
          phone: "—",
          jobTitle: "Administrator",
          employmentStatus: "Active",
          subDepartment: "—",
          role: UserRole.ADMIN,
          alsoManager: false,
        };
        await RedisService.setWithTTL(cacheKey, JSON.stringify(adminProfile), 300);
        return adminProfile;
      }
      return null;
    }

    const role = await AccessService.resolveRole(email);
    const alsoManager =
      role === UserRole.HRBP && employee.employeeId
        ? await AccessService.hasDirectReports(employee.employeeId)
        : false;

    let policy: string | undefined = undefined;
    let weeklyOff: string | undefined = undefined;
    let shiftName: string | undefined = undefined;
    let allowedTimings: string | undefined = undefined;
    let preferredTiming: string | undefined = undefined;
    let halfDay: string | undefined = undefined;

    if (employee.employeeId) {
      const assignment = await AppDataSource.getRepository(EmployeeShiftAssignment).findOne({
        where: { employeeId: employee.employeeId },
        relations: ["shift"]
      });
      if (assignment) {
        policy = assignment.policy || undefined;
        weeklyOff = assignment.weeklyOff || undefined;
        preferredTiming = assignment.preferredTiming || undefined;
        if (assignment.shift) {
          shiftName = assignment.shift.name;
          allowedTimings = assignment.shift.allowedTimings || undefined;
          halfDay = assignment.shift.halfDay || undefined;
          
          if (!weeklyOff && assignment.shift.offDays) {
            weeklyOff = assignment.shift.offDays;
          }
        }
      }
    }

    const zoneMap: Record<string, string> = {
      "chennai": "Tamil Nadu Zone",
      "coimbatore": "Tamil Nadu Zone",
      "bangalore": "Karnataka Zone",
      "hyderabad": "Telangana Zone",
      "vizag": "Telangana Zone",
      "pune": "Maharashtra Zone",
      "mumbai": "Maharashtra Zone",
      "delhi": "Delhi Zone",
      "dubai": "Dubai Zone"
    };

    let mappedZone: string | undefined = undefined;
    let upcomingHolidays: any[] = [];

    if (employee.zone) {
      mappedZone = zoneMap[employee.zone.toLowerCase()];
      if (mappedZone) {
        const allHolidays = await holidayRepository.findAll();
        
        upcomingHolidays = allHolidays.filter(h => {
          return h.zones && h.zones.includes(mappedZone as string);
        }).map(h => ({
          name: h.name,
          startDate: h.startDate,
          endDate: h.endDate,
          isOptional: h.isOptional
        }));
      }
    }

    const profileData = {
      name: formatValue(employee.fullName),
      employeeId: formatValue(employee.employeeId),
      reportingManager: formatValue(employee.directManagerName),
      hod: formatValue(employee.hodEmployeeName),
      department: formatValue(employee.department),
      email: formatValue(employee.officialEmailId),
      phone: formatValue(employee.officeMobileNumber),
      jobTitle: formatValue(employee.jobTitle),
      employmentStatus: formatValue(employee.employmentStatus),
      subDepartment: formatValue(employee.subDepartment),
      zone: formatValue(employee.zone),
      role,
      alsoManager,
      policy,
      weeklyOff,
      shiftName,
      allowedTimings,
      preferredTiming,
      halfDay,
      mappedZone,
      upcomingHolidays,
    };

    await RedisService.setWithTTL(cacheKey, JSON.stringify(profileData), 300);
    return profileData;
  })();

    this.profilePromiseCache.set(cacheKey, computePromise);
    try {
      return await computePromise;
    } finally {
      this.profilePromiseCache.delete(cacheKey);
    }
  }

  static async updatePreferredTiming(email: string, preferredTiming: string): Promise<void> {
    const employee = await AppDataSource.getRepository(EmployeeData).findOneBy({ officialEmailId: email });
    if (!employee || !employee.employeeId) {
      throw new Error("Employee not found");
    }

    const assignment = await AppDataSource.getRepository(EmployeeShiftAssignment).findOne({
      where: { employeeId: employee.employeeId },
      relations: ["shift"]
    });
    if (!assignment) {
      throw new Error("No shift assignment found");
    }

    if (assignment.shift && assignment.shift.allowedTimings) {
      const opts = assignment.shift.allowedTimings.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
      if (!opts.includes(preferredTiming)) {
        throw new Error("Invalid preferred timing. Not in allowed timings.");
      }
    }

    assignment.preferredTiming = preferredTiming;
    await AppDataSource.getRepository(EmployeeShiftAssignment).save(assignment);
  }
}
