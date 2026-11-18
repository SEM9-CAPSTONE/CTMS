import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import type {
	AssignedReviewPorter,
	PorterParticipationCandidate,
	PorterRatingSummary,
	PorterReviewParticipation,
	PorterReviewRecord,
} from "./porter-reviews.types";

const REVIEW_COLUMNS = `id, booking_id AS "bookingId", member_id AS "memberId",
	reviewer_id AS "reviewerId", trip_id AS "tripId", porter_id AS "porterId",
	rating, comment, revision, moderation_status AS "moderationStatus",
	edit_expires_at AS "editExpiresAt", created_at AS "createdAt", updated_at AS "updatedAt"`;

@Injectable()
export class PorterReviewsRepository {
	async participations(
		manager: EntityManager,
		userId: string,
		now: Date,
		page: number,
		limit: number
	): Promise<PorterParticipationCandidate[]> {
		// Never broaden Booking ownership reads: this projection contains only own review participation.
		return manager.query(
			`SELECT b.id AS "bookingId", m.id AS "memberId", m.user_id AS "reviewerId",
			b.trip_id AS "tripId", t.host_id AS "hostId", b.status AS "bookingStatus",
			b.completed_at AS "completedAt", m.member_status AS "memberStatus",
			m.checked_in_at AS "checkedInAt", m.left_at AS "leftAt",
			t.title AS "tripTitle", t.starts_at AS "startsAt",
			EXISTS (SELECT 1 FROM trip_porters tp WHERE tp.trip_id=b.trip_id
				AND tp.status='assigned') AS "hasAssignedPorter"
			FROM bookings b JOIN booking_members m ON m.booking_id=b.id
			JOIN trips t ON t.id=b.trip_id
			WHERE m.user_id=$1 AND b.status='completed' AND m.member_status='joined'
			AND m.checked_in_at IS NOT NULL AND m.checked_in_at<=b.completed_at
			AND m.left_at IS NULL AND b.completed_at<=$2
			ORDER BY b.completed_at DESC, b.id ASC, m.id ASC LIMIT $3 OFFSET $4`,
			[userId, now, limit + 1, (page - 1) * limit]
		);
	}

	async participation(
		manager: EntityManager,
		userId: string,
		bookingId: string
	): Promise<PorterReviewParticipation | null> {
		const rows: PorterReviewParticipation[] = await manager.query(
			`SELECT b.id AS "bookingId", m.id AS "memberId", m.user_id AS "reviewerId",
			b.trip_id AS "tripId", t.host_id AS "hostId", b.status AS "bookingStatus",
			b.completed_at AS "completedAt", m.member_status AS "memberStatus",
			m.checked_in_at AS "checkedInAt", m.left_at AS "leftAt"
			FROM bookings b JOIN booking_members m ON m.booking_id = b.id
			JOIN trips t ON t.id = b.trip_id
			WHERE b.id = $1 AND m.user_id = $2 ORDER BY m.id
			FOR UPDATE OF b, m FOR SHARE OF t`,
			[bookingId, userId]
		);
		return rows[0] ?? null;
	}

	async assignedPorters(manager: EntityManager, tripId: string): Promise<AssignedReviewPorter[]> {
		// Lock the assignment while validating a write so removal cannot race its creation.
		return manager.query(
			`SELECT tp.porter_id AS "porterId", u.full_name AS "porterName"
			FROM trip_porters tp JOIN users u ON u.id = tp.porter_id
			WHERE tp.trip_id = $1 AND tp.status = 'assigned'
			ORDER BY tp.porter_id FOR SHARE OF tp`,
			[tripId]
		);
	}

	async now(manager: EntityManager): Promise<Date> {
		const [row]: Array<{ now: Date }> = await manager.query("SELECT clock_timestamp() AS now");
		return row.now;
	}

	listOwn(
		manager: EntityManager,
		userId: string,
		bookingId: string
	): Promise<PorterReviewRecord[]> {
		return manager.query(
			`SELECT ${REVIEW_COLUMNS} FROM porter_reviews
			WHERE reviewer_id = $1 AND booking_id = $2 ORDER BY porter_id`,
			[userId, bookingId]
		);
	}

	async names(manager: EntityManager, porterIds: string[]): Promise<AssignedReviewPorter[]> {
		if (!porterIds.length) return [];
		return manager.query(
			'SELECT id AS "porterId", full_name AS "porterName" FROM users WHERE id = ANY($1::uuid[])',
			[porterIds]
		);
	}

	async findOwn(
		manager: EntityManager,
		userId: string,
		reviewId: string,
		lock = false
	): Promise<PorterReviewRecord | null> {
		const rows: PorterReviewRecord[] = await manager.query(
			`SELECT ${REVIEW_COLUMNS} FROM porter_reviews
			WHERE id = $1 AND reviewer_id = $2 ${lock ? "FOR UPDATE" : ""}`,
			[reviewId, userId]
		);
		return rows[0] ?? null;
	}

	async insert(manager: EntityManager, review: PorterReviewRecord): Promise<boolean> {
		const rows: Array<{ id: string }> = await manager.query(
			`INSERT INTO porter_reviews
			(id, booking_id, member_id, reviewer_id, trip_id, porter_id, rating, comment,
			revision, edit_expires_at, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$10)
			ON CONFLICT (member_id, reviewer_id, porter_id) DO NOTHING RETURNING id`,
			[
				review.id,
				review.bookingId,
				review.memberId,
				review.reviewerId,
				review.tripId,
				review.porterId,
				review.rating,
				review.comment,
				review.editExpiresAt,
				review.createdAt,
			]
		);
		return rows.length === 1;
	}

	async update(manager: EntityManager, review: PorterReviewRecord): Promise<void> {
		await manager.query(
			`UPDATE porter_reviews SET rating = $2, comment = $3, revision = $4,
			updated_at = $5 WHERE id = $1`,
			[review.id, review.rating, review.comment, review.revision, review.updatedAt]
		);
	}

	async recordRevision(manager: EntityManager, review: PorterReviewRecord): Promise<void> {
		await manager.query(
			`INSERT INTO porter_review_revisions (review_id, revision, rating, comment, recorded_at)
			VALUES ($1,$2,$3,$4,$5)`,
			[review.id, review.revision, review.rating, review.comment, review.updatedAt]
		);
	}

	/** Internal input for CTMS-413; never expose private review content through aggregates. */
	async ratingSummary(manager: EntityManager, porterId: string): Promise<PorterRatingSummary> {
		// PostgreSQL completion timestamps can have microseconds; persisted JS deadlines have milliseconds.
		const [summary]: PorterRatingSummary[] = await manager.query(
			`SELECT $1::uuid AS "porterId", avg(r.rating)::float8 AS "ratingAverage",
			count(r.id)::int AS "ratingCount"
			FROM porter_reviews r JOIN booking_members m ON m.id = r.member_id
			JOIN bookings b ON b.id = m.booking_id
			WHERE r.porter_id = $1 AND r.moderation_status = 'visible'
			AND m.user_id = r.reviewer_id AND b.id = r.booking_id AND b.trip_id = r.trip_id
			AND b.status = 'completed' AND m.member_status = 'joined' AND m.left_at IS NULL
			AND m.checked_in_at <= b.completed_at
			AND r.created_at >= date_trunc('milliseconds', b.completed_at)
			AND r.created_at < b.completed_at + interval '24 hours'
			AND date_trunc('milliseconds', r.edit_expires_at) =
			date_trunc('milliseconds', b.completed_at + interval '24 hours')`,
			[porterId]
		);
		return summary;
	}
}
