import { ConflictException, Injectable, Logger } from "@nestjs/common";
import * as bcrypt from "bcrypt";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import { isUniqueViolation } from "../../shared/database/postgres-error-codes";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { UsersRepository } from "../users/users.repository";
import type { RegisterDto } from "./dto/register.dto";
import { type UserProfileDto, toUserProfile } from "./dto/user-profile.dto";

const BCRYPT_COST_FACTOR = 10;
const DUPLICATE_CONTACT_MESSAGE = "Email or phone already registered";

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	constructor(
		private readonly usersRepository: UsersRepository,
		private readonly dataSource: DataSource
	) {}

	async register(dto: RegisterDto): Promise<UserProfileDto> {
		const email = dto.email ?? null;
		const phone = dto.phone ?? null;

		const existing = await this.usersRepository.findByEmailOrPhone(email, phone);
		if (existing) {
			throw new ConflictException(DUPLICATE_CONTACT_MESSAGE);
		}

		const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);

		const user = await this.dataSource.transaction(async (manager) => {
			const transactionalUsersRepository = manager.withRepository(this.usersRepository);

			try {
				return await transactionalUsersRepository.createUser({
					email,
					phone,
					passwordHash,
					role: dto.role,
				});
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ConflictException(DUPLICATE_CONTACT_MESSAGE);
				}
				throw error;
			}
		});

		this.logger.log(`User registered: ${user.id}`);

		return toUserProfile(user);
	}
}
