import { AppDataSource, Shift, EmployeeShiftAssignment, EmployeeData } from "@hr-portal/database";
import { describeWorkingDays, normalizeShiftName, resolveWeeklyOff, shiftKey } from "./shiftRules";

const shiftOrm = AppDataSource.getRepository(Shift);
const assignmentOrm = AppDataSource.getRepository(EmployeeShiftAssignment);
// Keeps each DELETE ... IN (...) well under the database's parameter limit.
const DELETE_CHUNK = 1000;

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

  /** Removes the employee's shift and weekly off (their sheet row had no valid shift). */
  async deleteAssignment(employeeId: string): Promise<void> {
    await assignmentOrm.delete({ employeeId });
  }

  /** Removes assignments whose employee is no longer in employee data. Returns how many. */
  async deleteOrphanAssignments(): Promise<number> {
    const employees = await AppDataSource.getRepository(EmployeeData).find({ select: ["employeeId"] });
    const known = new Set(employees.map((e) => e.employeeId).filter(Boolean));
    const orphanIds = (await assignmentOrm.find({ select: ["id", "employeeId"] }))
      .filter((a) => !known.has(a.employeeId))
      .map((a) => a.id);
    for (let i = 0; i < orphanIds.length; i += DELETE_CHUNK) {
      await assignmentOrm.delete(orphanIds.slice(i, i + DELETE_CHUNK));
    }
    return orphanIds.length;
  }

  /**
   * Removes shifts that are not in the uploaded Shift Detail tab and no employee is assigned to.
   * Returns the removed names.
   */
  async deleteUnusedShifts(keepKeys: Set<string>): Promise<string[]> {
    const used = new Set((await assignmentOrm.find({ select: ["shiftId"] })).map((a) => a.shiftId));
    const unused = (await shiftOrm.find()).filter((s) => !keepKeys.has(shiftKey(s.name)) && !used.has(s.id));
    if (unused.length > 0) await shiftOrm.delete(unused.map((s) => s.id));
    return unused.map((s) => s.name);
  }

  async getAllEmployeeShifts(filters: Record<string, string> = {}): Promise<any[]> {
    const where: any = {};
    if (filters.department && filters.department !== "all") {
      where.department = filters.department;
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
