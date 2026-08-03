import { UserRole } from "@hr-portal/database";
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
    };
  }
}
