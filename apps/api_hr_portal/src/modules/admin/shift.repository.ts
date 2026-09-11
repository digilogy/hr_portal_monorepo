import { AppDataSource, Shift, EmployeeShiftAssignment } from "@hr-portal/database";

const shiftOrm = AppDataSource.getRepository(Shift);
const assignmentOrm = AppDataSource.getRepository(EmployeeShiftAssignment);

export class ShiftRepository {
  async findShiftByName(name: string): Promise<Shift | null> {
    return shiftOrm.findOneBy({ name });
  }

  async createShift(data: Partial<Shift>): Promise<Shift> {
    const shift = shiftOrm.create(data);
    return shiftOrm.save(shift);
  }

  async updateShift(shift: Shift, data: Partial<Shift>): Promise<Shift> {
    Object.assign(shift, data);
    return shiftOrm.save(shift);
  }

  async upsertAssignment(data: {
    employeeId: string;
    policy?: string;
    weeklyOff?: string;
    shiftId: number;
  }): Promise<EmployeeShiftAssignment> {
    let assignment = await assignmentOrm.findOneBy({ employeeId: data.employeeId });
    if (assignment) {
      assignment.policy = (data.policy || null) as any;
      assignment.weeklyOff = (data.weeklyOff || null) as any;
      assignment.shiftId = data.shiftId;
    } else {
      assignment = assignmentOrm.create({ ...data });
    }
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
      return {
        employeeId: emp.employeeId,
        name: emp.fullName,
        department: emp.department,
        shiftName: assignment?.shift?.name || null,
        shiftTimings: assignment?.shift?.allowedTimings || null,
        workingDays: assignment?.shift?.workingDays || null,
        offDays: assignment?.shift?.offDays || null,
        halfDay: assignment?.shift?.halfDay || null,
      };
    });
  }
}

export const shiftRepository = new ShiftRepository();
