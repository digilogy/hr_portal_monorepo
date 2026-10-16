export type SystemNoticeType = "info" | "warning" | "error";
/** Single-row table holding the portal-wide maintenance / announcement banner. */
export declare class SystemNotice {
    id: number;
    message: string;
    type: SystemNoticeType;
    isActive: boolean;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=SystemNotice.d.ts.map