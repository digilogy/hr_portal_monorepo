"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const User_1 = require("./entities/User");
const Timesheet_1 = require("./entities/Timesheet");
const EmployeeData_1 = require("./entities/EmployeeData");
const UploadJob_1 = require("./entities/UploadJob");
const UploadLog_1 = require("./entities/UploadLog");
const EmailLog_1 = require("./entities/EmailLog");
const config_1 = require("@hr-portal/config");
exports.AppDataSource = new typeorm_1.DataSource({
    type: "mysql",
    host: config_1.env.DB_HOST,
    port: config_1.env.DB_PORT,
    username: config_1.env.DB_USER,
    password: config_1.env.DB_PASSWORD,
    database: config_1.env.DB_NAME,
    // Disable automatic DDL synchronization in production to prevent "DROP INDEX check that it exists" errors
    synchronize: config_1.env.NODE_ENV !== "production" && config_1.env.TYPEORM_SYNCHRONIZE === "true",
    logging: false,
    entities: [User_1.User, Timesheet_1.Timesheet, EmployeeData_1.EmployeeData, UploadJob_1.UploadJob, UploadLog_1.UploadLog, EmailLog_1.EmailLog],
    migrations: [],
    subscribers: [],
});
//# sourceMappingURL=data-source.js.map