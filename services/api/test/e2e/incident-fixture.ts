import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { hash } from "bcrypt";
import { Client } from "pg";

interface Fixture {
	tripId: string;
	publishedTripId: string;
	routeId: string;
	hostId: string;
	porterId: string;
	outsiderId: string;
	hostEmail: string;
	porterEmail: string;
	outsiderEmail: string;
	password: string;
	title: string;
}

async function main(): Promise<void> {
	const url = process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_test";
	if (!new URL(url).pathname.endsWith("_test"))
		throw new Error("E2E fixture refuses non-test database");
	const client = new Client({ connectionString: url });
	await client.connect();
	try {
		const action = process.argv[2];
		if (action === "seed") {
			const suffix = randomUUID();
			const fixture: Fixture = {
				tripId: randomUUID(),
				publishedTripId: randomUUID(),
				routeId: randomUUID(),
				hostId: randomUUID(),
				porterId: randomUUID(),
				outsiderId: randomUUID(),
				hostEmail: `ctms49-host-${suffix}@example.com`,
				porterEmail: `ctms49-porter-${suffix}@example.com`,
				outsiderEmail: `ctms49-outsider-${suffix}@example.com`,
				password: "IncidentE2e@123",
				title: `CTMS49 ${suffix}`,
			};
			await client.query("BEGIN");
			const passwordHash = await hash(fixture.password, 4);
			for (const [id, email, role] of [
				[fixture.hostId, fixture.hostEmail, "host"],
				[fixture.porterId, fixture.porterEmail, "porter"],
				[fixture.outsiderId, fixture.outsiderEmail, "porter"],
			]) {
				await client.query(
					`INSERT INTO users (id,email,password_hash,role,status,full_name)
					VALUES ($1,$2,$3,$4,'active',$5)`,
					[id, email, passwordHash, role, `CTMS49 ${role}`]
				);
				await client.query("INSERT INTO user_roles (user_id,role) VALUES ($1,$2)", [id, role]);
			}
			await client.query(
				`INSERT INTO trekking_routes
				(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
				VALUES ($1,$2,$3,ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22,16.04),ST_MakePoint(108.25,16.07)),4326)::geography,3500,'moderate',240,'active')`,
				[fixture.routeId, fixture.hostId, fixture.title]
			);
			for (const [tripId, status] of [
				[fixture.tripId, "ongoing"],
				[fixture.publishedTripId, "published"],
			]) {
				await client.query(
					`INSERT INTO trips
					(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
					VALUES ($1,$2,$3,$4,'day_trip',0,now()-interval '2 hours',now()+interval '6 hours',
					ST_SetSRID(ST_MakePoint(108.22,16.04),4326)::geography,now()-interval '1 day',1,20,0,0,$5)`,
					[
						tripId,
						fixture.hostId,
						fixture.routeId,
						status === "ongoing" ? fixture.title : `${fixture.title} published`,
						status,
					]
				);
				await client.query(
					"INSERT INTO trip_porters (trip_id,porter_id,status) VALUES ($1,$2,'assigned')",
					[tripId, fixture.porterId]
				);
			}
			await client.query("COMMIT");
			process.stdout.write(JSON.stringify(fixture));
			return;
		}
		const fixture = JSON.parse(Buffer.from(process.argv[3] ?? "", "base64").toString()) as Fixture;
		// IDs alone never authorize mutation/cleanup: verify the uniquely named test owner.
		const owner = await client.query(
			"SELECT id FROM users WHERE id=$1 AND email=$2 AND email LIKE 'ctms49-host-%@example.com'",
			[fixture.hostId, fixture.hostEmail]
		);
		if (owner.rowCount !== 1) throw new Error("Fixture owner does not match CTMS49 test data");
		const tripIds = [fixture.tripId, fixture.publishedTripId];
		switch (action) {
			case "read": {
				const rows = await client.query(
					`SELECT id, description, occurred_at AS "occurredAt", captured_offline AS "capturedOffline",
					media_url AS "mediaUrl", location_status AS "locationStatus" FROM trip_incidents WHERE trip_id=ANY($1) ORDER BY received_at`,
					[tripIds]
				);
				process.stdout.write(JSON.stringify(rows.rows));
				break;
			}
			case "revoke":
				await client.query(
					"UPDATE trip_porters SET status='unassigned' WHERE trip_id=$1 AND porter_id=$2",
					[fixture.tripId, fixture.porterId]
				);
				process.stdout.write("{}");
				break;
			case "clean": {
				const media = await client.query<{ media_url: string | null }>(
					"SELECT media_url FROM trip_incidents WHERE trip_id=ANY($1)",
					[tripIds]
				);
				await client.query("BEGIN");
				await client.query(
					"DELETE FROM audit_logs WHERE target_id IN (SELECT id FROM trip_incidents WHERE trip_id=ANY($1))",
					[tripIds]
				);
				await client.query("DELETE FROM trip_incidents WHERE trip_id=ANY($1)", [tripIds]);
				await client.query("DELETE FROM trip_porters WHERE trip_id=ANY($1)", [tripIds]);
				await client.query("DELETE FROM trips WHERE id=ANY($1) AND host_id=$2", [
					tripIds,
					fixture.hostId,
				]);
				await client.query("DELETE FROM trekking_routes WHERE id=$1 AND host_id=$2", [
					fixture.routeId,
					fixture.hostId,
				]);
				await client.query("DELETE FROM refresh_tokens WHERE user_id=ANY($1)", [
					[fixture.hostId, fixture.porterId, fixture.outsiderId],
				]);
				await client.query("DELETE FROM user_roles WHERE user_id=ANY($1)", [
					[fixture.hostId, fixture.porterId, fixture.outsiderId],
				]);
				await client.query("DELETE FROM audit_logs WHERE actor_id=ANY($1)", [
					[fixture.hostId, fixture.porterId, fixture.outsiderId],
				]);
				await client.query("DELETE FROM users WHERE id=ANY($1)", [
					[fixture.hostId, fixture.porterId, fixture.outsiderId],
				]);
				await client.query("COMMIT");
				for (const row of media.rows) {
					if (row.media_url?.startsWith("/uploads/incidents/")) {
						await rm(
							resolve(__dirname, "../../uploads/e2e-incidents/incidents", basename(row.media_url)),
							{ force: true }
						);
					}
				}
				process.stdout.write("{}");
				break;
			}
			default:
				throw new Error(`Unsupported fixture action: ${action}`);
		}
	} finally {
		await client.end();
	}
}
void main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
