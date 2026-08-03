import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { Timesheet } from "./Timesheet";

export enum UserRole {
  ADMIN = "admin",
  HRBP = "hrbp",
  MANAGER = "manager",
  EMPLOYEE = "employee",
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "first_name", nullable: true })
  firstName!: string;

  @Column({ name: "last_name", nullable: true })
  lastName!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ nullable: true })
  pin!: string; // Hashed PIN

  @Column({ type: "enum", enum: UserRole, default: UserRole.EMPLOYEE })
  role!: UserRole;

  @OneToMany(() => Timesheet, (timesheet) => timesheet.user)
  timesheets!: Timesheet[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}