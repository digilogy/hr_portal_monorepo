import { Timesheet } from "./Timesheet";
export declare enum UserRole {
    ADMIN = "admin",
    HRBP = "hrbp",
    MANAGER = "manager",
    EMPLOYEE = "employee"
}
export declare class User {
    id: number;
    name: string;
    email: string;
    pin: string;
    role: UserRole;
    timesheets: Timesheet[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=User.d.ts.map