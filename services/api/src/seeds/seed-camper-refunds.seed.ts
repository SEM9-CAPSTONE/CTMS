import dataSource from "../shared/database/data-source";

export async function seedCamperRefunds(): Promise<{
	preTripBookingId: string;
	completedBookingId: string;
	alreadyRefundedBookingId: string;
}> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:camper-refunds] Database initialized.");

	// 1. Get camper@ctms.local user
	const camperRows = (await dataSource.query('SELECT "id" FROM "users" WHERE "email" = $1', [
		"camper@ctms.local",
	])) as Array<{ id: string }>;
	if (camperRows.length === 0) {
		throw new Error("User camper@ctms.local not found. Please ensure accounts are seeded.");
	}
	const camperId = camperRows[0].id;

	// 2. Get host and route
	const tripRows = (await dataSource.query(
		`SELECT t.id, t.title, t.route_id, t.host_id, t.price_per_person
		 FROM trips t
		 WHERE t.status = 'published'
		 LIMIT 3`
	)) as Array<{
		id: string;
		title: string;
		route_id: string;
		host_id: string;
		price_per_person: string;
	}>;

	if (tripRows.length === 0) {
		throw new Error("No published trips found. Run seed:dev-trips first.");
	}

	const trip1 = tripRows[0];
	const trip2Source = tripRows[1] ?? tripRows[0];
	const trip3 = tripRows[2] ?? tripRows[0];

	// Create a completed trip for Scenario 2 (ended 3 hours ago)
	const meetingPoint = { type: "Point", coordinates: [108.2022, 16.0544] };
	const completedTripRows = (await dataSource.query(
		`INSERT INTO "trips" (
			"host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, 'Trekking Sơn Trà Hoàn Thành - Demo Khiếu Nại', 'Chuyến đi vừa hoàn thành cách đây 3 giờ', 'day_trip', 0,
			now() - interval '10 hours', now() - interval '3 hours',
			ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, now() - interval '1 day',
			1, 10, '850000.00', 'completed',
			'{"version": 1, "rules": [{"minHoursBeforeTrip": 24, "refundPercent": 50}]}'::jsonb
		 ) RETURNING "id"`,
		[trip2Source.host_id, trip2Source.route_id, JSON.stringify(meetingPoint)]
	)) as Array<{ id: string }>;
	const completedTripId = completedTripRows[0].id;

	// Add waypoints for the completed trip
	await dataSource.query(
		`INSERT INTO "trip_waypoints" ("trip_id", "type", "name", "location", "day_number", "sequence_order")
		 VALUES
		 ($1, 'start', 'Điểm xuất phát', ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, 1, 1),
		 ($1, 'finish', 'Điểm về đích', ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, 1, 2)`,
		[completedTripId, JSON.stringify(meetingPoint)]
	);

	// SCENARIO 1: Pre-trip cancelled booking with paid charge (Eligible for pre-trip refund)
	const b1Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancelled_at", "cancellation_reason", "cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'cancelled', 'paid', "starts_at", "ends_at", $3, $3,
		        now() - interval '2 hours', 'Bận việc gia đình đột xuất', "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip1.id, camperId, trip1.price_per_person || "650000.00"]
	)) as Array<{ id: string }>;
	const b1Id = b1Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b1Id, camperId]
	);

	const p1Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', $2, $3, 'fp-b1', 'PAYOS-DEMO-001'
		 ) RETURNING "id"`,
		[b1Id, trip1.price_per_person || "650000.00", `demo-pay-${b1Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p1Rows[0].id]
	);

	// SCENARIO 2: Post-completion completed participation (Eligible for complaint refund within 24h)
	const b2Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '850000.00', '850000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[completedTripId, camperId]
	)) as Array<{ id: string }>;
	const b2Id = b2Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status", "checked_in_at")
		 VALUES ($1, $2, true, 'joined', now() - interval '9 hours')`,
		[b2Id, camperId]
	);

	const p2Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '850000.00', $2, 'fp-b2', 'PAYOS-DEMO-002'
		 ) RETURNING "id"`,
		[b2Id, `demo-pay-${b2Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p2Rows[0].id]
	);

	// SCENARIO 3: Already refunded booking (Fully processed refund)
	const b3Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancelled_at", "cancellation_reason", "cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'cancelled', 'paid', "starts_at", "ends_at", '500000.00', '500000.00',
		        now() - interval '1 day', 'Hủy do thay đổi lịch trình', "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip3.id, camperId]
	)) as Array<{ id: string }>;
	const b3Id = b3Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b3Id, camperId]
	);

	const p3Charge = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '500000.00', $2, 'fp-b3-charge', 'PAYOS-DEMO-003'
		 ) RETURNING "id"`,
		[b3Id, `demo-pay-${b3Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p3Charge[0].id]
	);

	// Refund payment referencing the charge
	const p3Refund = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "parent_payment_id", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'refund', 'succeeded', '500000.00', $2, $3, 'fp-b3-refund', 'PAYOS-REF-500000'
		 ) RETURNING "id"`,
		[b3Id, p3Charge[0].id, `demo-refund-${b3Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status", "transaction_ref") VALUES ($1, 'succeeded', 'PAYOS-REF-500000')`,
		[p3Refund[0].id]
	);

	console.log(
		`[seed:camper-refunds] Scenario 1 (Pre-Trip Cancelled): http://localhost:5173/bookings/${b1Id}`
	);
	console.log(
		`[seed:camper-refunds] Scenario 2 (Post-Completion Complaint): http://localhost:5173/bookings/${b2Id}`
	);
	console.log(
		`[seed:camper-refunds] Scenario 3 (Already Refunded): http://localhost:5173/bookings/${b3Id}`
	);

	return {
		preTripBookingId: b1Id,
		completedBookingId: b2Id,
		alreadyRefundedBookingId: b3Id,
	};
}

if (require.main === module) {
	seedCamperRefunds()
		.then(async () => {
			if (dataSource.isInitialized) {
				await dataSource.destroy();
			}
		})
		.catch((err) => {
			console.error(err);
			process.exitCode = 1;
		});
}
