import { Injectable } from "@nestjs/common";
import { type FindOptionsWhere, Repository } from "typeorm";
import type { User, UserRole } from "./entities/user.entity";
import type { PaginatedUsers, UserAccountFilters } from "./users.types";

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
	async findAccounts(filters: UserAccountFilters): Promise<PaginatedUsers> {
		const query = this.createQueryBuilder("user");
		if (filters.search) {
			query.andWhere(
				"(user.fullName ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search)",
				{ search: `%${filters.search}%` }
			);
		}
		if (filters.role) {
			query.andWhere("user.role = :role", { role: filters.role });
		}
		if (filters.status) {
			query.andWhere("user.status = :status", { status: filters.status });
		}

		const [users, total] = await query
			.orderBy("user.createdAt", "DESC")
			.addOrderBy("user.id", "ASC")
			.skip((filters.page - 1) * filters.limit)
			.take(filters.limit)
			.getManyAndCount();
		return { users, total };
	}

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
