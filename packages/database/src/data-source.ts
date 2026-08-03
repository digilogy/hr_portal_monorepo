import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Timesheet } from "./entities/Timesheet";
import { EmployeeData } from "./entities/EmployeeData";
import { UploadJob } from "./entities/UploadJob";
import { UploadLog } from "./entities/UploadLog";
import { EmailLog } from "./entities/EmailLog";
import { env } from "@hr-portal/config";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  // Disable automatic DDL synchronization in production to prevent "DROP INDEX check that it exists" errors
  synchronize: env.NODE_ENV !== "production" && env.TYPEORM_SYNCHRONIZE === "true",
  logging: false,
  entities: [User, Timesheet, EmployeeData, UploadJob, UploadLog, EmailLog],
  migrations: [],
  subscribers: [],
});
