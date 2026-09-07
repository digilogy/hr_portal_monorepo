import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("holiday")
export class Holiday {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Index()
  @Column({ type: "date" })
  startDate!: Date;

  @Index()
  @Column({ type: "date" })
  endDate!: Date;

  @Column({ type: "json" })
  zones!: string[];

  @Column({ default: false })
  isOptional!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
