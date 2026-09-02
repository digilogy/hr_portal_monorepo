import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("shifts")
export class Shift {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string;

  @Column({ nullable: true })
  allowedTimings?: string;

  @Column({ nullable: true })
  workingDays?: string;

  @Column({ nullable: true })
  offDays?: string;

  @Column({ nullable: true })
  halfDay?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
