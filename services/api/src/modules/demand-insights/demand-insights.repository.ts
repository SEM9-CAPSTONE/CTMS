import { ForbiddenException, Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import type { DemandSource } from "./demand-insights.policy";
@Injectable()
export class DemandInsightsRepository {
	async authorize(m: EntityManager, actor: string): Promise<void> {
		const users: { allowed: boolean }[] = await m.query(
			`SELECT true AS allowed FROM users u WHERE u.id=$1 AND u.status='active' AND (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='host') OR (u.role='host' AND NOT EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id)))`,
			[actor]
		);
		if (!users.length) throw new ForbiddenException("Active Host access required");
	}
	async source(m: EntityManager, start: Date, end: Date): Promise<DemandSource[]> {
		return m.query(
			`SELECT b.id AS booking,b.user_id AS booker,t.host_id AS host,t.trip_type AS "tripType",r.difficulty
 FROM bookings b JOIN trips t ON t.id=b.trip_id JOIN trekking_routes r ON r.id=t.route_id
 JOIN users u ON u.id=b.user_id JOIN users h ON h.id=t.host_id
 WHERE b.created_at >= $1 AND b.created_at < $2 AND b.status IN ('confirmed','completed') AND b.cancelled_at IS NULL
 AND t.status IN ('published','ongoing','completed') AND u.status <> 'deleted' AND h.status <> 'deleted'
 AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.booking_id=b.id AND p.type='refund' AND p.status <> 'failed')
 ORDER BY b.id`,
			[start, end]
		);
	}
}
