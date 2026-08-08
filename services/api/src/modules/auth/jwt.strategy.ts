import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

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
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get<string>("JWT_SECRET") ?? "",
		});
	}

	validate(payload: JwtPayload): AuthenticatedUser {
		return { userId: payload.sub, roles: payload.roles };
	}
}
