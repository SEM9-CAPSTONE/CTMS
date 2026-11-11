import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity({ name: "user_bank_accounts" })
export class UserBankAccount {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "user_id", type: "uuid" })
	userId!: string;

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "user_id" })
	user!: User;

	@Column({ name: "bank_name", type: "varchar", length: 100 })
	bankName!: string;

	@Column({ name: "account_number", type: "varchar", length: 50 })
	accountNumber!: string;

	@Column({ name: "account_holder_name", type: "varchar", length: 100 })
	accountHolderName!: string;

	@Column({ name: "is_default", type: "boolean", default: false })
	isDefault!: boolean;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
