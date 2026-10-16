import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export type SystemNoticeType = "info" | "warning" | "error";

/** Single-row table holding the portal-wide maintenance / announcement banner. */
@Entity("system_notice")
export class SystemNotice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text", default: "" })
  message!: string;

  @Column({ type: "varchar", default: "warning" })
  type!: SystemNoticeType;

  @Column({ default: false })
  isActive!: boolean;

  @Column({ type: "varchar", nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
