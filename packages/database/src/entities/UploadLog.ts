import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { UploadJob } from "./UploadJob";

@Entity("upload_log")
export class UploadLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => UploadJob, (job) => job.logs, { onDelete: "CASCADE" })
  job!: UploadJob;

  @Column({ nullable: true })
  rowIndex?: number;

  @Column({ nullable: true })
  employeeId?: string;

  @Column({ nullable: true })
  status!: string;

  @Column({ nullable: true, type: "text" })
  message?: string;

  @Column({ type: "json", nullable: true })
  payload?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;
}
