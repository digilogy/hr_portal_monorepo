import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("employee_data")
export class EmployeeData {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  employmentStatus?: string;

  @Index()
  @Column({ nullable: true })
  employeeId?: string;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  jobTitle?: string;

  @Column({ nullable: true })
  department?: string;

  @Column({ nullable: true })
  subDepartment?: string;

  @Column({ nullable: true })
  directManagerEmployeeId?: string;

  @Column({ nullable: true })
  directManagerName?: string;

  @Column({ nullable: true })
  hrbpEmployeeId?: string;

  @Column({ nullable: true })
  hrbpName?: string;

  @Column({ nullable: true })
  hodEmployeeId?: string;

  @Column({ nullable: true })
  hodEmployeeName?: string;

  @Index()
  @Column({ nullable: true })
  officialEmailId?: string;

  @Column({ nullable: true })
  officeMobileNumber?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
