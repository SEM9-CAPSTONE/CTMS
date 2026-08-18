import { hash } from "bcrypt";
import type { DataSource } from "typeorm";
import { CampsiteStatus } from "../../src/modules/campsites/entities/campsite.entity";
import { ZoneStatus } from "../../src/modules/campsites/entities/zone.entity";

/**
 * CTMS-17-T01 (CTMS-77). Every fixture created through this module carries
 * this marker in `province` (campsites) or `email` (the host account) so
 * integration tests can run against a shared dev Postgres with zero risk of
 * colliding with, or accidentally matching against, real data -- and so
 * cleanup can target exactly (and only) what a test created. Mirrors the
 * `e2e-*`-prefixed-email / tracked-id-array cleanup convention already used
 * by test/audit-logs.integration-spec.ts.
 */
export const CAMPSITE_FIXTURE_MARKER = "CTMS77FIX";

function uniqueSuffix(): string {
	return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export interface CampsiteFixtureInput {
	hostId: string;
	name?: string;
	province?: string;
	city?: string;
	status?: CampsiteStatus;
	latitude?: string;
	longitude?: string;
}

export interface ZoneFixtureInput {
	name?: string;
	capacity?: number;
	location?: string;
	basePrice?: string;
	amenities?: string[];
	status?: ZoneStatus;
}

export interface CampsiteImageFixtureInput {
	url?: string;
	type?: string;
	displayOrder?: number;
}

/**
 * Accumulates every row id this module inserts for one test (or
 * `beforeEach`), so {@link cleanupCampsiteFixtures} can delete exactly
 * those rows -- not a blanket "delete everything under the marker" sweep,
 * which could race against a concurrently-running test file.
 */
export class CampsiteFixtureTracker {
	readonly hostIds: string[] = [];
	readonly campsiteIds: string[] = [];
}

export async function createFixtureHost(
	dataSource: DataSource,
	tracker: CampsiteFixtureTracker
): Promise<string> {
	const passwordHash = await hash("S3curePass!", 10);
	const rows = (await dataSource.query(
		`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
		 VALUES ($1, $2, 'host', 'active', 'Fixture Host') RETURNING "id"`,
		[
			`e2e-${CAMPSITE_FIXTURE_MARKER.toLowerCase()}-host-${uniqueSuffix()}@example.com`,
			passwordHash,
		]
	)) as Array<{ id: string }>;
	const id = rows[0].id;
	await dataSource.query(
		`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, 'host') ON CONFLICT ("user_id", "role") DO NOTHING`,
		[id]
	);
	tracker.hostIds.push(id);
	return id;
}

/** Defaults to `status: active` -- override per-test for draft/suspended/closed/archived/pending_approval scenarios. */
export async function createFixtureCampsite(
	dataSource: DataSource,
	tracker: CampsiteFixtureTracker,
	input: CampsiteFixtureInput
): Promise<string> {
	const rows = (await dataSource.query(
		`INSERT INTO "campsites"
		   ("host_id", "name", "description", "latitude", "longitude", "province", "city", "policies", "operating_hours", "status")
		 VALUES ($1, $2, 'fixture campsite', $3, $4, $5, $6, 'n/a', 'n/a', $7)
		 RETURNING "id"`,
		[
			input.hostId,
			input.name ?? `${CAMPSITE_FIXTURE_MARKER} campsite ${uniqueSuffix()}`,
			input.latitude ?? "10.000000",
			input.longitude ?? "106.000000",
			input.province ?? CAMPSITE_FIXTURE_MARKER,
			input.city ?? "FixtureCity",
			input.status ?? CampsiteStatus.ACTIVE,
		]
	)) as Array<{ id: string }>;
	const id = rows[0].id;
	tracker.campsiteIds.push(id);
	return id;
}

/** Defaults to `status: active`, no amenities, base_price 100.00 -- override per scenario. */
export async function createFixtureZone(
	dataSource: DataSource,
	campsiteId: string,
	input: ZoneFixtureInput = {}
): Promise<string> {
	const rows = (await dataSource.query(
		`INSERT INTO "zones" ("campsite_id", "name", "capacity", "location", "base_price", "amenities", "status")
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING "id"`,
		[
			campsiteId,
			input.name ?? "Fixture Zone",
			input.capacity ?? 4,
			input.location ?? "n/a",
			input.basePrice ?? "100.00",
			input.amenities ?? [],
			input.status ?? ZoneStatus.ACTIVE,
		]
	)) as Array<{ id: string }>;
	return rows[0].id;
}

export async function createFixtureImage(
	dataSource: DataSource,
	campsiteId: string,
	input: CampsiteImageFixtureInput = {}
): Promise<string> {
	const rows = (await dataSource.query(
		`INSERT INTO "campsite_images" ("campsite_id", "url", "type", "display_order")
		 VALUES ($1, $2, $3, $4)
		 RETURNING "id"`,
		[
			campsiteId,
			input.url ?? "https://example.com/fixture.jpg",
			input.type ?? "photo",
			input.displayOrder ?? 0,
		]
	)) as Array<{ id: string }>;
	return rows[0].id;
}

/**
 * Deletes every row `tracker` recorded, children-first (FK order):
 * campsite_images/zones -> campsites -> user_roles -> users. `= ANY($1)`
 * against an empty array matches zero rows rather than erroring, so this is
 * always safe to call even if a test failed before creating anything.
 */
export async function cleanupCampsiteFixtures(
	dataSource: DataSource,
	tracker: CampsiteFixtureTracker
): Promise<void> {
	if (tracker.campsiteIds.length > 0) {
		await dataSource.query(`DELETE FROM "campsite_images" WHERE "campsite_id" = ANY($1)`, [
			tracker.campsiteIds,
		]);
		await dataSource.query(`DELETE FROM "zones" WHERE "campsite_id" = ANY($1)`, [
			tracker.campsiteIds,
		]);
		await dataSource.query(`DELETE FROM "campsites" WHERE "id" = ANY($1)`, [tracker.campsiteIds]);
	}
	if (tracker.hostIds.length > 0) {
		await dataSource.query(`DELETE FROM "user_roles" WHERE "user_id" = ANY($1)`, [tracker.hostIds]);
		await dataSource.query(`DELETE FROM "users" WHERE "id" = ANY($1)`, [tracker.hostIds]);
	}
}
