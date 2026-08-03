import "reflect-metadata";
import dotenv from "dotenv";
import { AppDataSource, User } from "@hr-portal/database";
import { AccessService } from "../src/modules/access/access.service";

dotenv.config();

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);
  const users = await userRepo.find();

  let updated = 0;
  for (const user of users) {
    const resolvedRole = await AccessService.resolveRole(user.email, user.role);
    if (user.role !== resolvedRole) {
      user.role = resolvedRole;
      await userRepo.save(user);
      updated += 1;
      console.log(`Updated ${user.email}: ${resolvedRole}`);
    }
  }

  console.log(`\nChecked ${users.length} users, updated ${updated}.`);
  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
