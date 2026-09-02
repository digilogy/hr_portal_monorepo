import { AppDataSource, EmployeeData, UploadJob, UploadLog } from "@hr-portal/database";

const employeeDataOrm = AppDataSource.getRepository(EmployeeData);
const uploadLogOrm = AppDataSource.getRepository(UploadLog);

export class EmployeeDataRepository {
  async findByEmployeeId(employeeId: string): Promise<EmployeeData | null> {
    return employeeDataOrm
      .createQueryBuilder("employee")
      .where("LOWER(employee.employeeId) = LOWER(:employeeId)", { employeeId })
      .getOne();
  }

  async findByEmailCaseInsensitive(email: string): Promise<EmployeeData | null> {
    return employeeDataOrm
      .createQueryBuilder("employee")
      .where("LOWER(employee.officialEmailId) = LOWER(:email)", { email })
      .getOne();
  }

  create(data: Record<string, string>): EmployeeData {
    return employeeDataOrm.create(data);
  }

  async save(entity: EmployeeData): Promise<EmployeeData> {
    return employeeDataOrm.save(entity);
  }

  async createUploadLog(
    job: UploadJob,
    rowIndex: number,
    employeeId: string,
    status: "success" | "failed",
    message: string,
    payload: Record<string, string>,
  ): Promise<void> {
    await uploadLogOrm.save(
      uploadLogOrm.create({
        job,
        rowIndex,
        employeeId: employeeId || undefined,
        status,
        message,
        payload,
      }),
    );
  }

  async deleteUnprocessed(processedIds: number[]): Promise<{ affected?: number | null }> {
    return employeeDataOrm
      .createQueryBuilder()
      .delete()
      .from(EmployeeData)
      .where("id NOT IN (:...processedIds)", { processedIds })
      .execute();
  }
}

export const employeeDataRepository = new EmployeeDataRepository();
