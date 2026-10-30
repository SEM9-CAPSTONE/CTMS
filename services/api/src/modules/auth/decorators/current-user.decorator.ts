import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { AuthenticatedUser } from "../jwt.strategy";

export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthenticatedUser =>
		context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user
);
