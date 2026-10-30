import { AppDataSource, Shift, EmployeeShiftAssignment } from "@hr-portal/database";
import { describeWorkingDays, normalizeShiftName, resolveWeeklyOff, shiftKey } from "./shiftRules";

const shiftOrm = AppDataSource.getRepository(Shift);
const assignmentOrm = AppDataSource.getRepository(EmployeeShiftAssignment);

export class ShiftRepository {
  /** All shifts keyed by shiftKey(name). When two names share a key, the exact spelling wins. */
  async getShiftsByKey(): Promise<Map<string, Shift>> {
    const byKey = new Map<string, Shift>();
    for (const shift of await shiftOrm.find()) {
      const key = shiftKey(shift.name);
      const current = byKey.get(key);
      if (!current || shift.name === normalizeShiftName(shift.name)) byKey.set(key, shift);
    }
    return byKey;
  }

  async createShift(data: Partial<Shift>): Promise<Shift> {
    const shift = shiftOrm.create(data);
    return shiftOrm.save(shift);
  }

  async updateShift(shift: Shift, data: Partial<Shift>): Promise<Shift> {
    Object.assign(shift, data);
    return shiftOrm.save(shift);
  }

  /** policy left undefined keeps the saved value (sheet has no Policy column). */
  async upsertAssignment(data: {
    employeeId: string;
    policy?: string;
    weeklyOff: string | null;
    shiftId: number;
  }): Promise<EmployeeShiftAssignment> {
    let assignment = await assignmentOrm.findOneBy({ employeeId: data.employeeId });
    if (!assignment) {
      assignment = assignmentOrm.create({ employeeId: data.employeeId });
    }
    if (data.policy !== undefined) assignment.policy = (data.policy || null) as any;
    assignment.weeklyOff = data.weeklyOff as any;
    assignment.shiftId = data.shiftId;
    return assignmentOrm.save(assignment);
  }

  async getAllEmployeeShifts(filters: Record<string, string> = {}): Promise<any[]> {
    const where: any = {};
    if (filters.department && filters.department !== "all") {
      where.department = filters.department;
    }
    if (filters.subDepartment && filters.subDepartment !== "all") {
      where.subDepartment = filters.subDepartment;
    }
    if (filters.manager && filters.manager !== "all") {
      where.directManagerName = filters.manager;
    }
    if (filters.employee && filters.employee !== "all") {
      where.employeeId = filters.employee;
    }

    const employees = await AppDataSource.getRepository("EmployeeData").find({
      where,
      select: ["employeeId", "fullName", "department"]
    });
    
    const assignments = await assignmentOrm.find({
      relations: ["shift"]
    });

    const assignmentMap = new Map();
    for (const a of assignments) {
      assignmentMap.set(a.employeeId, a);
    }

    return employees.map((emp: any) => {
      const assignment = assignmentMap.get(emp.employeeId);
      const offDays = assignment ? resolveWeeklyOff(assignment.weeklyOff, assignment.shift?.offDays) : null;
      return {
        employeeId: emp.employeeId,
        name: emp.fullName,
        department: emp.department,
        shiftName: assignment?.shift?.name || null,
        shiftTimings: assignment?.shift?.allowedTimings || null,
        workingDays: offDays ? describeWorkingDays(offDays) : null,
        offDays,
        halfDay: assignment?.shift?.halfDay || null,
      };
    });
  }
}

export const shiftRepository = new ShiftRepository();
