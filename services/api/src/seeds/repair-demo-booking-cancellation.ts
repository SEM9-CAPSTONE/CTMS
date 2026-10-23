import { createHash } from "node:crypto";
import type { DataSource } from "typeorm";
import { parseCancellationPolicy } from "../modules/bookings/cancellation-policy";
interface DemoBooking {
	id: string;
	status: string;
	paymentStatus: string;
	email: string;
	title: string;
	totalAmount: string;
	policy: unknown;
	snapshot: unknown;
	idempotencyKey: string | null;
	fingerprint: string | null;
}
const DEMO_EMAILS = new Set([
	"camper@ctms.local",
	"camper.lan@ctms.local",
	"camper.nam@ctms.local",
	"camper.tuan@ctms.local",
	"camper.nhu@ctms.local",
]);
/** Repair synthetic seed data only. Never call from a booking/payment request. */
export async function repairDemoBookingCancellation(dataSource: DataSource, bookingId: string) {
	if (process.env.NODE_ENV === "production")
		throw new Error("Demo repair is disabled in production");
	return dataSource.transaction(async (manager) => {
		const rows: DemoBooking[] = await manager.query(
			`SELECT b.id,b.status,b.payment_status AS "paymentStatus",u.email,t.title,b.total_amount AS "totalAmount",t.cancellation_policy AS policy,b.cancellation_policy_snapshot AS snapshot,b.idempotency_key AS "idempotencyKey",b.request_fingerprint AS fingerprint
   FROM bookings b JOIN users u ON u.id=b.user_id JOIN trips t ON t.id=b.trip_id WHERE b.id=$1 FOR UPDATE OF b,t`,
			[bookingId]
		);
		const booking = rows[0];
		if (
			!booking ||
			!DEMO_EMAILS.has(booking.email) ||
			!booking.title.startsWith("[CTMS-024]") ||
			booking.idempotencyKey ||
			booking.fingerprint
		)
			throw new Error("Refusing to repair a non-seed Booking");
		if (booking.status !== "confirmed" || booking.paymentStatus !== "paid")
			return { policyRepaired: false, chargeCreated: false };
		const policy = parseCancellationPolicy(booking.policy);
		let policyRepaired = false;
		if (booking.snapshot === null) {
			await manager.query(
				"UPDATE bookings SET cancellation_policy_snapshot=$2::jsonb WHERE id=$1",
				[bookingId, JSON.stringify(policy)]
			);
			policyRepaired = true;
		}
		const payments: { id: string }[] = await manager.query(
			"SELECT id FROM payments WHERE booking_id=$1",
			[bookingId]
		);
		let chargeCreated = false;
		if (!payments.length && Number(booking.totalAmount) > 0) {
			const key = `demo-seed:charge:${bookingId}`;
			const charge: { id: string }[] = await manager.query(
				`INSERT INTO payments (booking_id,type,status,amount,idempotency_key,request_fingerprint,provider_reference) VALUES ($1,'charge','succeeded',$2,$3,$4,'DEMO-SEED-NO-REAL-PAYMENT') RETURNING id`,
				[bookingId, booking.totalAmount, key, createHash("sha256").update(key).digest("hex")]
			);
			await manager.query(
				`INSERT INTO payment_transactions (payment_id,status,raw_payload) VALUES ($1,'succeeded',$2::jsonb)`,
				[charge[0].id, JSON.stringify({ source: "demo-seed-repair", simulated: true })]
			);
			chargeCreated = true;
		}
		if (policyRepaired || chargeCreated)
			await manager.query(
				`INSERT INTO audit_logs (actor_id,action,target_type,target_id,before,after,reason) SELECT user_id,'demo.booking_repaired','booking',id,$2::jsonb,$3::jsonb,'Repair synthetic seed policy/payment evidence; no real payment' FROM bookings WHERE id=$1`,
				[
					bookingId,
					JSON.stringify({ policySnapshot: booking.snapshot, paymentCount: payments.length }),
					JSON.stringify({ policyRepaired, chargeCreated }),
				]
			);
		return { policyRepaired, chargeCreated };
	});
}
