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

  async upsertAssignment(data: {
    employeeId: string;
    policy?: string;
    weeklyOff?: string;
    shiftId: number;
  }): Promise<EmployeeShiftAssignment> {
    let assignment = await assignmentOrm.findOneBy({ employeeId: data.employeeId });
    if (assignment) {
      assignment.policy = data.policy;
      assignment.weeklyOff = data.weeklyOff;
      assignment.shiftId = data.shiftId;
    } else {
      assignment = assignmentOrm.create({ ...data });
    }
    return assignmentOrm.save(assignment);
  }
}

export const shiftRepository = new ShiftRepository();
