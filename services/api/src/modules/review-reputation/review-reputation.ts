import type { EntityManager } from "typeorm";

export interface ReviewReputation {
	ratingAverage: number | null;
	ratingCount: number;
}

const SOURCES = {
	host: {
		table: "trip_reviews",
		subject: "host_id",
		window: "72 hours",
		constraint: "r.target = 'host' AND r.target_id = r.host_id",
	},
	porter: {
		table: "porter_reviews",
		subject: "porter_id",
		window: "24 hours",
		constraint: `date_trunc('milliseconds', r.edit_expires_at) =
			date_trunc('milliseconds', b.completed_at + interval '24 hours')`,
	},
} as const;

export function reputationFor(
	reputations: ReadonlyMap<string, ReviewReputation>,
	subjectId: string
): ReviewReputation {
	return reputations.get(subjectId) ?? { ratingAverage: null, ratingCount: 0 };
}

export async function readReviewReputations(
	db: Pick<EntityManager, "query">,
	role: keyof typeof SOURCES,
	subjectIds: readonly string[]
): Promise<Map<string, ReviewReputation>> {
	const ids = [...new Set(subjectIds)];
	if (ids.length === 0) return new Map();

	const { table, subject, window, constraint } = SOURCES[role];
	// Join by primary key so a current review can contribute only once.
	// The existing Porter window compares the JS-millisecond creation boundary.
	const rows: Array<ReviewReputation & { subjectId: string }> = await db.query(
		`SELECT r.${subject} AS "subjectId", avg(r.rating)::float8 AS "ratingAverage",
			count(*)::int AS "ratingCount"
		FROM ${table} r JOIN booking_members m ON m.id = r.member_id
		JOIN bookings b ON b.id = m.booking_id
		WHERE r.${subject} = ANY($1::uuid[]) AND r.moderation_status = 'visible'
		AND m.user_id = r.reviewer_id AND b.id = r.booking_id AND b.trip_id = r.trip_id
		AND b.status = 'completed' AND m.member_status = 'joined' AND m.left_at IS NULL
		AND m.checked_in_at <= b.completed_at
		AND r.created_at >= date_trunc('milliseconds', b.completed_at)
		AND r.created_at < b.completed_at + interval '${window}'
		AND ${constraint}
		GROUP BY r.${subject}`,
		[ids]
	);
	return new Map(
		rows.map(({ subjectId, ratingAverage, ratingCount }) => [
			subjectId,
			{ ratingAverage, ratingCount },
		])
	);
}
