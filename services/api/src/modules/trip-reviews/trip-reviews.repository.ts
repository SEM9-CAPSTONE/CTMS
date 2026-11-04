import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import type { ReviewParticipation, TripReviewRecord } from "./trip-reviews.types";

const REVIEW_COLUMNS = `id, booking_id AS "bookingId", member_id AS "memberId",
	reviewer_id AS "reviewerId", trip_id AS "tripId", host_id AS "hostId", target,
	target_id AS "targetId", rating, comment, images, revision,
	created_at AS "createdAt", updated_at AS "updatedAt"`;

@Injectable()
export class TripReviewsRepository {
	async summary(
		manager: EntityManager,
		userId: string
	): Promise<{ bookingId: string; count: number; canCreate: boolean }[]> {
		return manager.query(
			`SELECT b.id AS "bookingId", count(r.id)::int AS count,
		 (b.completed_at <= clock_timestamp() AND b.completed_at + interval '72 hours' > clock_timestamp()
		 AND m.member_status = 'joined' AND m.checked_in_at <= b.completed_at AND m.left_at IS NULL) IS TRUE AS "canCreate"
		 FROM bookings b JOIN booking_members m ON m.booking_id = b.id AND m.user_id = $1
		 LEFT JOIN trip_reviews r ON r.member_id = m.id AND r.reviewer_id = $1
		 WHERE b.status = 'completed' GROUP BY b.id, m.id`,
			[userId]
		);
	}

	async participation(
		manager: EntityManager,
		userId: string,
		bookingId: string
	): Promise<ReviewParticipation | null> {
		// Shared by reads/writes: serialize submissions and edits within a participation.
		const rows: ReviewParticipation[] = await manager.query(
			`SELECT b.id AS "bookingId",
			m.id AS "memberId", m.user_id AS "reviewerId", b.trip_id AS "tripId", t.host_id AS "hostId",
			b.status AS "bookingStatus", b.completed_at AS "completedAt", m.member_status AS "memberStatus",
			m.checked_in_at AS "checkedInAt", m.left_at AS "leftAt"
			FROM bookings b JOIN booking_members m ON m.booking_id = b.id JOIN trips t ON t.id = b.trip_id
			WHERE b.id = $1 AND m.user_id = $2 ORDER BY m.id FOR UPDATE OF b, m FOR SHARE OF t`,
			[bookingId, userId]
		);
		return rows[0] ?? null;
	}

	async now(manager: EntityManager): Promise<Date> {
		// CURRENT_TIMESTAMP is the transaction start, which may precede a long lock wait.
		const [row]: Array<{ now: Date }> = await manager.query("SELECT clock_timestamp() AS now");
		return row.now;
	}

	async listOwn(
		manager: EntityManager,
		userId: string,
		bookingId: string
	): Promise<TripReviewRecord[]> {
		return manager.query(
			`SELECT ${REVIEW_COLUMNS} FROM trip_reviews WHERE reviewer_id = $1 AND booking_id = $2 ORDER BY target`,
			[userId, bookingId]
		);
	}

	async find(manager: EntityManager, id: string): Promise<TripReviewRecord | null> {
		const rows: TripReviewRecord[] = await manager.query(
			`SELECT ${REVIEW_COLUMNS} FROM trip_reviews WHERE id = $1`,
			[id]
		);
		return rows[0] ?? null;
	}

	async insert(manager: EntityManager, review: TripReviewRecord): Promise<boolean> {
		const rows: Array<{ id: string }> = await manager.query(
			`INSERT INTO trip_reviews
			(id, booking_id, member_id, reviewer_id, trip_id, host_id, target, target_id, rating, comment, images, revision, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$12::jsonb,1,$11,$11)
			ON CONFLICT (reviewer_id, member_id, target) DO NOTHING RETURNING id`,
			[
				review.id,
				review.bookingId,
				review.memberId,
				review.reviewerId,
				review.tripId,
				review.hostId,
				review.target,
				review.targetId,
				review.rating,
				review.comment,
				review.createdAt,
				JSON.stringify(review.images ?? []),
			]
		);
		return rows.length === 1;
	}

	async update(manager: EntityManager, review: TripReviewRecord): Promise<void> {
		await manager.query(
			"UPDATE trip_reviews SET rating = $2, comment = $3, revision = $4, updated_at = $5, images = $6::jsonb WHERE id = $1",
			[
				review.id,
				review.rating,
				review.comment,
				review.revision,
				review.updatedAt,
				JSON.stringify(review.images ?? []),
			]
		);
	}

	async recordRevision(manager: EntityManager, review: TripReviewRecord): Promise<void> {
		await manager.query(
			`INSERT INTO trip_review_revisions (review_id, revision, rating, comment, recorded_at, images)
			VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
			[
				review.id,
				review.revision,
				review.rating,
				review.comment,
				review.updatedAt,
				JSON.stringify(review.images ?? []),
			]
		);
	}
}
