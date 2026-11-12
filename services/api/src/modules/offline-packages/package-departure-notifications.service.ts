import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource, type EntityManager } from "typeorm";

/** Same transaction as the blocked gate/audit. Rollback cannot leak a notification. */
export async function enqueueDepartureNotifications(
	m: EntityManager,
	tripId: string,
	reason: string
): Promise<void> {
	await m.query(
		`INSERT INTO offline_package_departure_notifications(id,episode_id,trip_id,recipient_id,reason_code)
  SELECT gen_random_uuid(),$2,t.id,recipient.id,$3 FROM trips t
  CROSS JOIN LATERAL (SELECT t.host_id AS id UNION SELECT porter_id AS id FROM trip_porters WHERE trip_id=t.id AND status='assigned') recipient
  WHERE t.id=$1 ON CONFLICT(episode_id,recipient_id) DO NOTHING`,
		[tripId, randomUUID(), reason]
	);
}

export interface DepartureNotification {
	active: boolean;
	id: string;
	tripId: string;
	reasonCode: string;
	createdAt: Date;
	readAt: Date | null;
}
@Injectable()
export class PackageDepartureNotificationsService {
	constructor(private readonly db: DataSource) {}
	async list(userId: string): Promise<DepartureNotification[]> {
		return this.db.query(
			`SELECT n.id,n.trip_id AS "tripId",n.reason_code AS "reasonCode",n.created_at AS "createdAt",n.read_at AS "readAt",
    (t.status='published' AND COALESCE(r.last_reason_code=n.reason_code,false)) AS active
   FROM offline_package_departure_notifications n JOIN trips t ON t.id=n.trip_id LEFT JOIN offline_package_requirements r ON r.trip_id=t.id
   WHERE n.recipient_id=$1 AND (t.host_id=$1 OR EXISTS(SELECT 1 FROM trip_porters p WHERE p.trip_id=t.id AND p.porter_id=$1 AND p.status='assigned'))
   ORDER BY n.created_at DESC,n.id DESC LIMIT 50`,
			[userId]
		);
	}
	async markRead(userId: string, id: string): Promise<{ read: true }> {
		const rows: Array<{ id: string }> = await this.db.query(
			`WITH changed AS (UPDATE offline_package_departure_notifications n SET read_at=COALESCE(read_at,now())
   FROM trips t WHERE n.trip_id=t.id AND n.id=$2 AND n.recipient_id=$1
   AND (t.host_id=$1 OR EXISTS(SELECT 1 FROM trip_porters p WHERE p.trip_id=t.id AND p.porter_id=$1 AND p.status='assigned')) RETURNING n.id) SELECT id FROM changed`,
			[userId, id]
		);
		if (!rows.length) throw new NotFoundException({ code: "NOTIFICATION_NOT_ACCESSIBLE" });
		return { read: true };
	}
}
