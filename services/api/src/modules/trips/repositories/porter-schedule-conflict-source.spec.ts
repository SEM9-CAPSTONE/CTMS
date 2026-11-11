import type { DataSource } from "typeorm";
import { TripPorterStatus } from "../../profiles/entities/trip-porter.entity";
import { PorterScheduleConflictSource } from "./porter-schedule-conflict-source";

const CONFLICTING_PORTER_ID = "11111111-1111-4111-8111-111111111111";

describe("PorterScheduleConflictSource", () => {
	it("uses strict interval overlap boundaries and returns assigned Porters", async () => {
		const query = jest.fn().mockResolvedValue([{ porterId: CONFLICTING_PORTER_ID }]);
		const source = new PorterScheduleConflictSource({ query } as unknown as DataSource);
		const startsAt = new Date("2035-01-10T06:00:00.000Z");
		const endsAt = new Date("2035-01-11T17:00:00.000Z");

		await expect(
			source.findConflictingPorterIds({ tripId: "target-trip", startsAt, endsAt })
		).resolves.toEqual([CONFLICTING_PORTER_ID]);

		const sql = query.mock.calls[0][0].replace(/\s+/g, " ");
		expect(sql).toContain('assigned_trip."starts_at" < $2');
		expect(sql).toContain('assigned_trip."ends_at" > $3');
		expect(query.mock.calls[0][1]).toEqual([
			[TripPorterStatus.ASSIGNED, TripPorterStatus.PENDING_RECONFIRMATION],
			endsAt,
			startsAt,
		]);
	});

	it("returns no conflict when the repository query finds no overlapping assignment", async () => {
		const query = jest.fn().mockResolvedValue([]);
		const source = new PorterScheduleConflictSource({ query } as unknown as DataSource);

		await expect(
			source.findConflictingPorterIds({
				tripId: "non-overlapping-trip",
				startsAt: new Date("2035-01-12T07:00:00.000Z"),
				endsAt: new Date("2035-01-12T16:00:00.000Z"),
			})
		).resolves.toEqual([]);
	});
});
