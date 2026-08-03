import "reflect-metadata";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { AppDataSource, User, EmployeeData } from "@hr-portal/database";
import { AccessService } from "../src/modules/access/access.service";

dotenv.config();

const EMAIL = (process.argv[2] || "").trim().toLowerCase();
const PIN = process.argv[3] || "";

async function main(): Promise<void> {
  if (!EMAIL || !PIN) {
    console.error("Usage: npx ts-node scripts/create-user.ts <email> <pin>");
    process.exit(1);
  }

  await AppDataSource.initialize();

  const employee = await AppDataSource.getRepository(EmployeeData)
    .createQueryBuilder("employee")
    .where("LOWER(employee.officialEmailId) = LOWER(:email)", { email: EMAIL })
    .getOne();

  if (!employee) {
    throw new Error(
      `Employee not found for ${EMAIL}. Add them to employee_data first.`,
    );
  }

  const userRepo = AppDataSource.getRepository(User);
  const hashedPin = await bcrypt.hash(PIN, 10);
  let user = await userRepo.findOneBy({ email: EMAIL });
  const role = await AccessService.resolveRole(EMAIL, user?.role);

  if (user) {
    user.pin = hashedPin;
    user.role = role;
    await userRepo.save(user);
    console.log(`Updated user #${user.id} (${EMAIL}) with role: ${role}`);
  } else {
    user = userRepo.create({ email: EMAIL, pin: hashedPin, role });
    await userRepo.save(user);
    console.log(`Created user #${user.id} (${EMAIL}) with role: ${role}`);
  }

  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
