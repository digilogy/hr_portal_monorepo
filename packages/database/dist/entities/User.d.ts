import { Timesheet } from "./Timesheet";
export declare enum UserRole {
    ADMIN = "admin",
    HRBP = "hrbp",
    MANAGER = "manager",
    EMPLOYEE = "employee"
}
export declare class User {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    pin: string;
    role: UserRole;
    timesheets: Timesheet[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=User.d.ts.map