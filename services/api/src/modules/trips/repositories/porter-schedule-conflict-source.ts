import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import { TripPorterStatus } from "../../profiles/entities/trip-porter.entity";

export interface PorterScheduleWindow {
	tripId: string;
	startsAt: Date;
	endsAt: Date;
}

/**
 * ADVISORY CTMS-44 compatibility source based on legacy trip_porters + trips.
 *
 * This boundary is intentionally replaceable by the authoritative CTMS-47
 * porter_assignments source. It is a read-time candidate filter only and MUST
 * NOT be treated as CTMS-47's concurrency check for Assignment creation.
 */
@Injectable()
export class PorterScheduleConflictSource {
	constructor(private readonly dataSource: DataSource) {}

	async findConflictingPorterIds(window: PorterScheduleWindow): Promise<string[]> {
		const rows = (await this.dataSource.query(
			`SELECT DISTINCT assignment."porter_id" AS "porterId"
			 FROM "trip_porters" assignment
			 INNER JOIN "trips" assigned_trip ON assigned_trip."id" = assignment."trip_id"
			 WHERE assignment."status" = ANY($1::trip_porter_status[])
			   AND assigned_trip."starts_at" < $2
			   AND assigned_trip."ends_at" > $3`,
			[
				[TripPorterStatus.ASSIGNED, TripPorterStatus.PENDING_RECONFIRMATION],
				window.endsAt,
				window.startsAt,
			]
		)) as Array<{ porterId: string }>;

		return rows.map((row) => row.porterId);
	}
}
