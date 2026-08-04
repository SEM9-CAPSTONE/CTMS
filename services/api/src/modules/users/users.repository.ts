import { Injectable } from "@nestjs/common";
import { type FindOptionsWhere, Repository } from "typeorm";
import type { User, UserRole } from "./entities/user.entity";

interface CreateUserInput {
	email: string | null;
	phone: string | null;
	passwordHash: string;
	role: UserRole;
}

/**
 * No custom constructor: EntityManager.withRepository() reconstructs this class
 * internally via `new UsersRepository(target, manager)`, matching Repository's own
 * constructor signature exactly. The default (non-transactional) instance is created
 * by a factory provider in UsersModule instead of relying on @Injectable() auto-wiring.
 */
@Injectable()
export class UsersRepository extends Repository<User> {
	async findByEmailOrPhone(email: string | null, phone: string | null): Promise<User | null> {
		const where: FindOptionsWhere<User>[] = [];
		if (email) {
			where.push({ email });
		}
		if (phone) {
			where.push({ phone });
		}

		if (where.length === 0) {
			return null;
		}

		return this.findOne({ where });
	}

	async createUser(data: CreateUserInput): Promise<User> {
		const user = this.create(data);
		return this.save(user);
	}
}
