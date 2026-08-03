import { EmployeeData, UserRole } from "@hr-portal/database";
import { env } from "@hr-portal/config";
import { accessRepository } from "./access.repository";

const ADMIN_EMAIL = env.ADMIN_USER.toLowerCase();

export class AccessService {
  static isAdminEmail(email: string): boolean {
    return email.toLowerCase() === ADMIN_EMAIL;
  }

  static async getEmployeeByEmail(
    email: string,
  ): Promise<EmployeeData | null> {
    const matches = await accessRepository.findByEmailCaseInsensitive(email);

    if (matches.length === 0) {
      return null;
    }

    if (matches.length === 1) {
      return matches[0];
    }

    return matches.reduce((best, current) => {
      const score = (record: EmployeeData) =>
        (record.employeeId?.trim() ? 4 : 0) +
        (record.officialEmailId?.trim() ? 2 : 0) +
        (record.fullName?.trim() ? 1 : 0);

      return score(current) > score(best) ? current : best;
    });
  }

  static async getHrbpAssignedEmployeeIds(
    employee: EmployeeData,
  ): Promise<Set<string>> {
    const assignedIds = new Set<string>();
    const hrbpEmployeeId = employee.employeeId?.trim();

    if (hrbpEmployeeId) {
      const byEmployeeId = await accessRepository.findEmployeeIdsByHrbpEmployeeId(hrbpEmployeeId);

      for (const record of byEmployeeId) {
        if (record.employeeId?.trim()) {
          assignedIds.add(record.employeeId.trim());
        }
      }
    }

    const hrbpName = employee.fullName?.trim();
    if (hrbpName) {
      const byName = await accessRepository.findEmployeeIdsByHrbpName(hrbpName);

      for (const record of byName) {
        if (record.employeeId?.trim()) {
          assignedIds.add(record.employeeId.trim());
        }
      }
    }

    return assignedIds;
  }

  static async hasDirectReports(employeeId: string): Promise<boolean> {
    const reportCount = await accessRepository.countDirectReports(employeeId.trim());
    return reportCount > 0;
  }

  /** HRBP portfolio plus full manager downline when the user also manages people. */
  static async getHrbpAndManagerScope(
    employee: EmployeeData,
  ): Promise<Set<string>> {
    const scope = await this.getHrbpAssignedEmployeeIds(employee);
    const employeeId = employee.employeeId?.trim();
    if (!employeeId) {
      return scope;
    }

    const isManager = await this.hasDirectReports(employeeId);
    if (!isManager) {
      return scope;
    }

    const downline = await this.getDownlineEmployeeIds(employeeId);
    downline.add(employeeId);
    for (const id of downline) {
      scope.add(id);
    }

    return scope;
  }

  static async resolveRole(
    email: string,
    storedRole?: UserRole,
  ): Promise<UserRole> {
    if (this.isAdminEmail(email) || storedRole === UserRole.ADMIN) {
      return UserRole.ADMIN;
    }

    const employee = await this.getEmployeeByEmail(email);
    if (!employee?.employeeId) {
      return UserRole.EMPLOYEE;
    }

    const hrbpScope = await this.getHrbpAssignedEmployeeIds(employee);
    if (hrbpScope.size > 0) {
      return UserRole.HRBP;
    }

    const isManager = await this.hasDirectReports(employee.employeeId);
    return isManager ? UserRole.MANAGER : UserRole.EMPLOYEE;
  }

  static async getDownlineEmployeeIds(
    managerEmployeeId: string,
  ): Promise<Set<string>> {
    const normalizedManagerId = managerEmployeeId.trim();
    const allEmployees = await accessRepository.findAllForHierarchy();

    const downline = new Set<string>();
    const queue = [normalizedManagerId];

    while (queue.length > 0) {
      const currentManagerId = queue.shift();
      if (!currentManagerId) continue;

      for (const employee of allEmployees) {
        const employeeId = employee.employeeId?.trim();
        const reportsTo = employee.directManagerEmployeeId?.trim();
        if (
          employeeId &&
          reportsTo === currentManagerId &&
          !downline.has(employeeId)
        ) {
          downline.add(employeeId);
          queue.push(employeeId);
        }
      }
    }

    return downline;
  }

  static async getAccessibleEmployeeIds(
    email: string,
    role: UserRole,
  ): Promise<Set<string> | "all"> {
    if (role === UserRole.ADMIN || this.isAdminEmail(email)) {
      return "all";
    }

    const employee = await this.getEmployeeByEmail(email);
    if (!employee?.employeeId) {
      return new Set();
    }

    if (role === UserRole.MANAGER) {
      const downline = await this.getDownlineEmployeeIds(employee.employeeId);
      downline.add(employee.employeeId);
      return downline;
    }

    if (role === UserRole.HRBP) {
      return await this.getHrbpAndManagerScope(employee);
    }

    return new Set([employee.employeeId]);
  }

  static async getAccessibleEmployees(
    email: string,
    role: UserRole,
  ): Promise<EmployeeData[]> {
    const scope = await this.getAccessibleEmployeeIds(email, role);

    if (scope === "all") {
      return accessRepository.findAll();
    }

    if (scope.size === 0) {
      return [];
    }

    return accessRepository.findByEmployeeIds([...scope]);
  }

  /** Employees visible in utilization reports (managers see downline only, not self). */
  static async getReportScopeEmployees(
    email: string,
    role: UserRole,
  ): Promise<EmployeeData[]> {
    const employees = await this.getAccessibleEmployees(email, role);

    if (role !== UserRole.MANAGER && role !== UserRole.HRBP) {
      return employees;
    }

    const currentEmployee = await this.getEmployeeByEmail(email);
    if (!currentEmployee?.employeeId) {
      return employees;
    }

    return employees.filter(
      (employee) => employee.employeeId !== currentEmployee.employeeId,
    );
  }

  static canAccessEmployee(
    accessibleIds: Set<string> | "all",
    employeeId?: string | null,
  ): boolean {
    if (!employeeId) return false;
    if (accessibleIds === "all") return true;
    return accessibleIds.has(employeeId);
  }

  static async isDepartmentHead(email: string): Promise<boolean> {
    const employee = await this.getEmployeeByEmail(email);
    if (!employee?.employeeId) return false;

    const byEmployeeId = await accessRepository.countByHodEmployeeId(employee.employeeId);
    if (byEmployeeId > 0) return true;

    const name = employee.fullName?.trim();
    if (!name) return false;

    const byName = await accessRepository.countByHodName(name);

    return byName > 0;
  }

  static async getReportCapabilities(
    email: string,
    role: UserRole,
  ): Promise<{
    userWise: boolean;
    managerWise: boolean;
    departmentWise: boolean;
    organizationWise: boolean;
  }> {
    if (role === UserRole.ADMIN || this.isAdminEmail(email)) {
      return {
        userWise: true,
        managerWise: true,
        departmentWise: true,
        organizationWise: true,
      };
    }

    if (role === UserRole.HRBP) {
      const employee = await this.getEmployeeByEmail(email);
      if (!employee?.employeeId) {
        return {
          userWise: false,
          managerWise: false,
          departmentWise: false,
          organizationWise: false,
        };
      }

      const portfolioIds = await this.getHrbpAssignedEmployeeIds(employee);
      if (portfolioIds.size === 0) {
        return {
          userWise: false,
          managerWise: false,
          departmentWise: false,
          organizationWise: false,
        };
      }

      return {
        userWise: true,
        managerWise: true,
        departmentWise: true,
        organizationWise: false,
      };
    }

    if (role !== UserRole.MANAGER) {
      return {
        userWise: false,
        managerWise: false,
        departmentWise: false,
        organizationWise: false,
      };
    }

    const employee = await this.getEmployeeByEmail(email);
    if (!employee?.employeeId) {
      return {
        userWise: false,
        managerWise: false,
        departmentWise: false,
        organizationWise: false,
      };
    }

    const downlineIds = await this.getDownlineEmployeeIds(employee.employeeId);
    const downlineCount = downlineIds.size;

    if (downlineCount === 0) {
      return {
        userWise: false,
        managerWise: false,
        departmentWise: false,
        organizationWise: false,
      };
    }

    let hasSubManagers = false;
    for (const managerId of downlineIds) {
      const teamInDownline = await accessRepository.countSubManagersInDownline(managerId, [...downlineIds]);

      if (teamInDownline > 0) {
        hasSubManagers = true;
        break;
      }
    }

    const isHod = await this.isDepartmentHead(email);

    return {
      userWise: true,
      managerWise: hasSubManagers,
      departmentWise: isHod,
      organizationWise: false,
    };
  }
}
