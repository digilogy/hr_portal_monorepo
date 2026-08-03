import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum EmailStatus {
  QUEUED = "queued",
  PROCESSING = "processing",
  SENT = "sent",
  FAILED = "failed",
}

export enum EmailType {
  PIN_SETUP = "pin_setup",
  PIN_RESET = "pin_reset",
}

export interface EmailPayload {
  link: string;
  description: string;
}

@Entity("email_log")
export class EmailLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  toEmail!: string;

  @Column()
  subject!: string;

  @Column({ type: "enum", enum: EmailType })
  emailType!: EmailType;

  @Column({ type: "json", nullable: true })
  payload?: EmailPayload;

  @Column({
    type: "enum",
    enum: EmailStatus,
    default: EmailStatus.QUEUED,
  })
  status!: EmailStatus;

  @Column({ default: 0 })
  attemptCount!: number;

  @Column({ default: 3 })
  maxAttempts!: number;

  @Column({ nullable: true, type: "text" })
  errorMessage?: string;

  @Column({ nullable: true })
  sesMessageId?: string;

  @Column({ nullable: true, type: "timestamp" })
  sentAt?: Date;

  @Column({ nullable: true, type: "timestamp" })
  nextRetryAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
