import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn
} from "typeorm";
import { Shift } from "./Shift";

@Entity("employee_shift_assignments")
export class EmployeeShiftAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column()
  employeeId!: string;

  @Column({ nullable: true })
  policy?: string;

  @Column({ nullable: true })
  weeklyOff?: string;

  @Column({ nullable: true })
  preferredTiming?: string;

  @Column()
  shiftId!: number;

  @ManyToOne(() => Shift)
  @JoinColumn({ name: "shiftId" })
  shift!: Shift;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
