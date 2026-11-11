import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { Reflector } from "@nestjs/core";
import type { UserRole } from "../../users/entities/user.entity";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedUser } from "../jwt.strategy";

const INSUFFICIENT_PERMISSION_MESSAGE = "Insufficient permission";

interface AuthenticatedRequest {
	user?: AuthenticatedUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles =
			this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
				context.getHandler(),
				context.getClass(),
			]) ?? [];

		if (requiredRoles.length === 0) {
			throw new ForbiddenException(INSUFFICIENT_PERMISSION_MESSAGE);
		}

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const grantedRoles = request.user?.roles ?? [];
		const hasRole = requiredRoles.some((role) => grantedRoles.includes(role));

		if (!hasRole) {
			throw new ForbiddenException(INSUFFICIENT_PERMISSION_MESSAGE);
		}

		return true;
	}
}
