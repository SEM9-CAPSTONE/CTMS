import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { User, UserRole } from "./user.entity";

@Entity({ name: "user_roles" })
export class UserRoleAssignment {
	@PrimaryColumn({ name: "user_id", type: "uuid" })
	userId!: string;

	@PrimaryColumn({ type: "enum", enum: UserRole, enumName: "users_role_enum" })
	role!: UserRole;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@ManyToOne(
		() => User,
		(user) => user.roleAssignments,
		{ onDelete: "CASCADE" }
	)
	@JoinColumn({ name: "user_id" })
	user!: User;
}
