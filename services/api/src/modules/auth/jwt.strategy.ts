import { Injectable, UnauthorizedException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { UsersRepository } from "../users/users.repository";

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentication required";

/** Minimal claims (Decision Gate D8): `roles` is an array even though a user
 * currently has exactly one role — avoids a payload-shape change the first
 * time multi-role support lands. */
export interface JwtPayload {
	sub: string;
	roles: string[];
}

export interface AuthenticatedUser {
	userId: string;
	roles: string[];
	status: UserStatus;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		configService: ConfigService,
		private readonly usersRepository: UsersRepository
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get<string>("JWT_SECRET") ?? "",
		});
	}

	async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
		const user = await this.usersRepository.findOneBy({ id: payload.sub });
		if (!user || user.status !== UserStatus.ACTIVE) {
			throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE);
		}
		return { userId: user.id, roles: [user.role], status: user.status };
	}
}
