import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { UploadLog } from "./UploadLog";

export enum UploadJobStatus {
  QUEUED = "queued",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity("upload_job")
export class UploadJob {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "originalName", nullable: true })
  fileName?: string;

  @Column({ name: "storedPath", nullable: true })
  filePath?: string;

  @Column({
    type: "enum",
    enum: UploadJobStatus,
    default: UploadJobStatus.QUEUED,
  })
  status!: UploadJobStatus;

  @Column({ default: 0 })
  totalRows!: number;

  @Column({ default: 0 })
  successCount!: number;

  @Column({ name: "errorCount", default: 0 })
  failureCount!: number;

  @Column({ default: 0 })
  processed!: number;

  @Column({ nullable: true, type: "text" })
  errorMessage?: string;

  @OneToMany(() => UploadLog, (log) => log.job, { cascade: true })
  logs!: UploadLog[];

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
