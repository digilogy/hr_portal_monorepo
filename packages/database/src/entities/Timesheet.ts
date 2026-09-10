import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from "typeorm";
import { User } from "./User";

export interface TimesheetSlot {
  key: string;
  timeSlot: string;
  title: string;
  task: string;
  taskType?: string;
  isLunch?: boolean;
}

@Entity()
@Unique(["user", "date"])
export class Timesheet {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.timesheets, { onDelete: "CASCADE" })
  user!: User;

  @Index()
  @Column({ type: "date" })
  date!: string;

  @Column({ type: "json" })
  slots!: TimesheetSlot[];

  @Column({ type: "float", default: 0 })
  totalHours!: number;

  @Column({ default: "saved" })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
