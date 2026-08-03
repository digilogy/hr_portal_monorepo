import { User } from "./User";
export interface TimesheetSlot {
    key: string;
    timeSlot: string;
    title: string;
    task: string;
    taskType?: string;
    isLunch?: boolean;
}
export declare class Timesheet {
    id: number;
    user: User;
    date: string;
    slots: TimesheetSlot[];
    totalHours: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Timesheet.d.ts.map