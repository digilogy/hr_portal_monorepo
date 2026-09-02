import { UserRole, AppDataSource, EmployeeShiftAssignment, EmployeeData } from "@hr-portal/database";
import { AccessService } from "../access/access.service";
import { profileRepository } from "./profile.repository";

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
}

function formatValue(value?: string | null): string {
  return value?.trim() || "—";
}

export class ProfileService {
  static async getProfileByEmail(
    email: string,
  ): Promise<EmployeeProfile | null> {
    const employee = await profileRepository.findByEmail(email);

    if (!employee) {
      if (AccessService.isAdminEmail(email)) {
        return {
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
        }
      }
    }

    return {
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
      role,
      alsoManager,
      policy,
      weeklyOff,
      shiftName,
      allowedTimings,
      preferredTiming,
    };
  }

  static async updatePreferredTiming(email: string, preferredTiming: string): Promise<void> {
    const employee = await AppDataSource.getRepository(EmployeeData).findOneBy({ officialEmailId: email });
    if (!employee || !employee.employeeId) {
      throw new Error("Employee not found");
    }

    const assignment = await AppDataSource.getRepository(EmployeeShiftAssignment).findOneBy({ employeeId: employee.employeeId });
    if (!assignment) {
      throw new Error("No shift assignment found");
    }

    assignment.preferredTiming = preferredTiming;
    await AppDataSource.getRepository(EmployeeShiftAssignment).save(assignment);
  }
}
