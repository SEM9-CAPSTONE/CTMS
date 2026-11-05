import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { UserRole } from "../users/entities/user.entity";

export async function authorizeAnalysis(
	m: EntityManager,
	actorId: string,
	tripId?: string,
	adminOnly = false
): Promise<void> {
	const users: { role: string; roles: string[] | null; status: string }[] = await m.query(
		`SELECT u.role,u.status,
  array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL) AS roles FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id
  WHERE u.id=$1 GROUP BY u.id`,
		[actorId]
	);
	const user = users[0];
	if (!user || user.status !== "active") throw new UnauthorizedException("Authentication required");
	const roles = user.roles ?? [user.role];
	const admin = roles.includes(UserRole.ADMIN);
	if (!admin && (adminOnly || !roles.includes(UserRole.HOST)))
		throw new ForbiddenException("Analysis access denied");
	if (tripId) {
		const trips: { host_id: string }[] = await m.query("SELECT host_id FROM trips WHERE id=$1", [
			tripId,
		]);
		if (!trips[0]) throw new NotFoundException("Trip not found");
		if (!admin && trips[0].host_id !== actorId)
			throw new ForbiddenException("Trip is not owned by this Host");
	}
}
