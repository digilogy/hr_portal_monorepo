import { AppDataSource, EmployeeData } from "@hr-portal/database";

const employeeDataOrm = AppDataSource.getRepository(EmployeeData);

export class ProfileRepository {
  async findByEmail(email: string): Promise<EmployeeData | null> {
    return employeeDataOrm
      .createQueryBuilder("employee")
      .where("LOWER(employee.officialEmailId) = LOWER(:email)", { email })
      .getOne();
  }
}

export const profileRepository = new ProfileRepository();
