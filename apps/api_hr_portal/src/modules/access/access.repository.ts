import { AppDataSource, EmployeeData } from "@hr-portal/database";
import { RedisService } from "@hr-portal/auth";

const employeeDataOrm = AppDataSource.getRepository(EmployeeData);

export class AccessRepository {
  async findByEmailCaseInsensitive(email: string): Promise<EmployeeData[]> {
    return employeeDataOrm
      .createQueryBuilder("employee")
      .where("LOWER(TRIM(employee.officialEmailId)) = LOWER(:email)", {
        email: email.trim(),
      })
      .orderBy("employee.updatedAt", "DESC")
      .getMany();
  }

  async findEmployeeIdsByHrbpEmployeeId(hrbpEmployeeId: string): Promise<EmployeeData[]> {
    return employeeDataOrm
      .createQueryBuilder("employee")
      .where("TRIM(employee.hrbpEmployeeId) = :hrbpEmployeeId", { hrbpEmployeeId })
      .select(["employee.employeeId"])
      .getMany();
  }

  async findEmployeeIdsByHrbpName(name: string): Promise<EmployeeData[]> {
    return employeeDataOrm
      .createQueryBuilder("employee")
      .where("LOWER(TRIM(employee.hrbpName)) = LOWER(:name)", { name })
      .select(["employee.employeeId"])
      .getMany();
  }

  async countDirectReports(managerId: string): Promise<number> {
    return employeeDataOrm
      .createQueryBuilder("employee")
      .where("TRIM(employee.directManagerEmployeeId) = :managerId", { managerId })
      .getCount();
  }

  async findAllForHierarchy(): Promise<EmployeeData[]> {
    const cacheKey = "cache:employees:hierarchy";
    const cached = await RedisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    const result = await employeeDataOrm.find({
      select: ["employeeId", "directManagerEmployeeId"],
    });
    if (result && result.length > 0) {
      await RedisService.setWithTTL(cacheKey, JSON.stringify(result), 300);
    }
    return result;
  }

  async findAll(): Promise<EmployeeData[]> {
    const cacheKey = "cache:employees:all";
    const cached = await RedisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    const result = await employeeDataOrm.find();
    if (result && result.length > 0) {
      await RedisService.setWithTTL(cacheKey, JSON.stringify(result), 300);
    }
    return result;
  }

  async findByEmployeeIds(ids: string[]): Promise<EmployeeData[]> {
    return employeeDataOrm
      .createQueryBuilder("employee")
      .where("employee.employeeId IN (:...ids)", { ids })
      .getMany();
  }

  async countByHodEmployeeId(employeeId: string): Promise<number> {
    return employeeDataOrm.count({ where: { hodEmployeeId: employeeId } });
  }

  async countByHodName(name: string): Promise<number> {
    return employeeDataOrm
      .createQueryBuilder("employee")
      .where("LOWER(TRIM(employee.hodEmployeeName)) = LOWER(:name)", { name })
      .getCount();
  }

  async countSubManagersInDownline(managerId: string, downlineIds: string[]): Promise<number> {
    return employeeDataOrm
      .createQueryBuilder("employee")
      .where("employee.directManagerEmployeeId = :managerId", { managerId })
      .andWhere("employee.employeeId IN (:...ids)", { ids: downlineIds })
      .getCount();
  }
}

export const accessRepository = new AccessRepository();
