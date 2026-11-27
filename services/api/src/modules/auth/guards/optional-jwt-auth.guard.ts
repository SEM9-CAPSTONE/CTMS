import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Populates `request.user` when a valid Bearer JWT is supplied, while allowing
 * unauthenticated guests through with `request.user = undefined` for public
 * read-only discovery endpoints (such as browsing published trips).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
	override handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser | undefined {
		return user || undefined;
	}
}
