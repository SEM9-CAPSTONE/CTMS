import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource, type EntityManager } from "typeorm";
import { InAppNotificationType } from "./in-app-notification.entity";
import type { ListInAppNotificationsDto } from "./in-app-notifications.dto";

export type NotificationTargetView =
	| { type: "trip"; tripId: string; title: string; action: "review" | "view" }
	| {
			type: "trip_review";
			tripId: string;
			reviewId: string;
			title: string;
			action: "moderate";
	  }
	| {
			type: "admin_content_reports";
			tripId: string;
			reviewId: string;
			title: string;
			action: "review";
	  };

export interface NotificationView {
	id: string;
	eventType: InAppNotificationType;
	occurredAt: string;
	createdAt: string;
	readAt: string | null;
	target: NotificationTargetView | null;
	targetAvailable: boolean;
}

interface NotificationRow {
	id: string;
	event_type: InAppNotificationType;
	occurred_at: Date;
	created_at: Date;
	cursor_time: string;
	read_at: Date | null;
	trip_id: string | null;
	review_id: string | null;
	title: string | null;
	accessible: boolean;
}

const HOST_REVIEW_MODERATION_EVENTS = new Set<InAppNotificationType>([
	InAppNotificationType.REVIEW_MODERATION_FLAGGED,
	InAppNotificationType.REVIEW_AUTO_HIDDEN,
	InAppNotificationType.REVIEW_MODERATION_UNVERIFIED,
	InAppNotificationType.REVIEW_MODERATION_REMINDER,
]);

// Match UsersRepository.getGrantedRoles: explicit assignments override the legacy role.
const HAS_ADMIN_ROLE = `(EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
	OR (NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id) AND u.role = 'admin'))`;
const HAS_HOST_ROLE = HAS_ADMIN_ROLE.replaceAll("'admin'", "'host'");

const SELECT_NOTIFICATION = `SELECT n.id, n.event_type, n.occurred_at, n.created_at, n.read_at,
	to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,
	n.trip_id, n.review_id, t.title, (t.id IS NOT NULL AND u.status = 'active' AND CASE
		WHEN n.event_type IN (
			'trip.review.moderation_flagged',
			'trip.review.auto_hidden',
			'trip.review.moderation_unverified',
			'trip.review.moderation_reminder'
		) THEN tr.id IS NOT NULL AND t.host_id = u.id AND ${HAS_HOST_ROLE}
		WHEN n.event_type = 'trip.review.moderation_escalated' THEN tr.id IS NOT NULL AND ${HAS_ADMIN_ROLE}
		WHEN n.event_type = 'trip.review.auto_rejected' THEN t.host_id = u.id AND ${HAS_HOST_ROLE}
		ELSE ${HAS_ADMIN_ROLE} END) AS accessible
	FROM in_app_notifications n JOIN users u ON u.id = n.recipient_id
	LEFT JOIN trips t ON t.id = n.trip_id
	LEFT JOIN trip_reviews tr ON tr.id = n.review_id`;

@Injectable()
export class InAppNotificationsService {
	constructor(private readonly dataSource: DataSource) {}

	/** Must be called inside the owning business transaction, never after it commits. */
	async enqueueTripReview(
		manager: EntityManager,
		tripId: string,
		eventType: InAppNotificationType,
		reviewRoundAt: string,
		occurredAt: Date
	): Promise<void> {
		// Submission audit identity is stable even if a pending Trip is later edited.
		// Older imported Trips may lack a submission audit; retain their deadline-window identity.
		const rounds: { id: string }[] = await manager.query(
			`SELECT id FROM audit_logs WHERE target_type = 'trip' AND target_id = $1
			 AND (action = 'trip.submitted_for_approval' OR
				(action = 'trip_waypoints.configured' AND "before"->>'status' = 'draft'))
			 ORDER BY created_at DESC, id DESC LIMIT 1`,
			[tripId]
		);
		const roundKey = rounds[0]?.id ?? new Date(reviewRoundAt).toISOString();
		const sourceKey = `${tripId}:${roundKey}:${eventType}`;
		await manager.query(
			`INSERT INTO in_app_notifications
				(recipient_id, trip_id, event_type, source_key, occurred_at)
			 SELECT u.id, t.id, $2::varchar, $3, $4 FROM users u CROSS JOIN trips t
			 WHERE t.id = $1 AND u.status = 'active' AND CASE
				WHEN $2::varchar = 'trip.review.auto_rejected' THEN u.id = t.host_id AND ${HAS_HOST_ROLE}
				ELSE ${HAS_ADMIN_ROLE} END
			 ON CONFLICT (source_key, recipient_id) DO NOTHING`,
			[tripId, eventType, sourceKey, occurredAt]
		);
	}

	/**
	 * Idempotently enqueues a review moderation notification inside the caller's transaction.
	 * Deduplicated across worker retries by UNIQUE (source_key, recipient_id).
	 */
	async enqueueTripReviewModeration(
		manager: EntityManager,
		params: {
			tripId: string;
			reviewId: string;
			eventType:
				| InAppNotificationType.REVIEW_MODERATION_FLAGGED
				| InAppNotificationType.REVIEW_AUTO_HIDDEN
				| InAppNotificationType.REVIEW_MODERATION_UNVERIFIED
				| InAppNotificationType.REVIEW_MODERATION_REMINDER
				| InAppNotificationType.REVIEW_MODERATION_ESCALATED;
			sourceKey: string;
			occurredAt: Date;
		}
	): Promise<void> {
		const isEscalated = params.eventType === InAppNotificationType.REVIEW_MODERATION_ESCALATED;
		await manager.query(
			`INSERT INTO in_app_notifications
				(recipient_id, trip_id, review_id, event_type, source_key, occurred_at)
			 SELECT u.id, t.id, $2::uuid, $3::varchar, $4, $5
			 FROM users u
			 CROSS JOIN trips t
			 WHERE t.id = $1
				AND u.status = 'active'
				AND ${isEscalated ? HAS_ADMIN_ROLE : `u.id = t.host_id AND ${HAS_HOST_ROLE}`}
			 ON CONFLICT (source_key, recipient_id) DO NOTHING`,
			[params.tripId, params.reviewId, params.eventType, params.sourceKey, params.occurredAt]
		);
	}

	async list(userId: string, query: ListInAppNotificationsDto) {
		const cursor = query.cursor ? decodeNotificationCursor(query.cursor) : null;
		const rows: NotificationRow[] = await this.dataSource.query(
			`${SELECT_NOTIFICATION} WHERE n.recipient_id = $1
			 AND ($2::timestamptz IS NULL OR (n.created_at, n.id) < ($2, $3::uuid))
			 AND ($4::text IS NULL OR CASE WHEN $4 = 'read' THEN n.read_at IS NOT NULL ELSE n.read_at IS NULL END)
			 ORDER BY n.created_at DESC, n.id DESC LIMIT $5`,
			[userId, cursor?.createdAt ?? null, cursor?.id ?? null, query.state ?? null, query.limit + 1]
		);
		const items = rows.slice(0, query.limit);
		const last = items.at(-1);
		return {
			items: items.map(notificationView),
			nextCursor:
				rows.length > query.limit && last
					? Buffer.from(JSON.stringify({ createdAt: last.cursor_time, id: last.id })).toString(
							"base64url"
						)
					: null,
		};
	}

	async unreadCount(userId: string): Promise<{ unreadCount: number }> {
		const rows: { count: string }[] = await this.dataSource.query(
			"SELECT count(*) AS count FROM in_app_notifications WHERE recipient_id = $1 AND read_at IS NULL",
			[userId]
		);
		return { unreadCount: Number(rows[0].count) };
	}

	async markRead(userId: string, notificationId: string): Promise<void> {
		const rows: { id: string }[] = await this.dataSource.query(
			`WITH updated AS (UPDATE in_app_notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
			 WHERE id = $1 AND recipient_id = $2 RETURNING id) SELECT id FROM updated`,
			[notificationId, userId]
		);
		if (rows.length === 0) throw new NotFoundException("Không tìm thấy thông báo.");
	}

	async findForDelivery(manager: EntityManager, id: string): Promise<NotificationView | null> {
		const rows: NotificationRow[] = await manager.query(`${SELECT_NOTIFICATION} WHERE n.id = $1`, [
			id,
		]);
		const row = rows[0];
		return row?.accessible ? notificationView(row) : null;
	}
}

function notificationView(row: NotificationRow): NotificationView {
	let target: NotificationTargetView | null = null;
	if (row.accessible && row.trip_id && row.title) {
		if (HOST_REVIEW_MODERATION_EVENTS.has(row.event_type) && row.review_id) {
			target = {
				type: "trip_review",
				tripId: row.trip_id,
				reviewId: row.review_id,
				title: row.title,
				action: "moderate",
			};
		} else if (
			row.event_type === InAppNotificationType.REVIEW_MODERATION_ESCALATED &&
			row.review_id
		) {
			target = {
				type: "admin_content_reports",
				tripId: row.trip_id,
				reviewId: row.review_id,
				title: row.title,
				action: "review",
			};
		} else {
			target = {
				type: "trip",
				tripId: row.trip_id,
				title: row.title,
				action: row.event_type === InAppNotificationType.AUTO_REJECTED ? "view" : "review",
			};
		}
	}
	return {
		id: row.id,
		eventType: row.event_type,
		occurredAt: row.occurred_at.toISOString(),
		createdAt: row.created_at.toISOString(),
		readAt: row.read_at?.toISOString() ?? null,
		targetAvailable: row.accessible,
		target,
	};
}

export function decodeNotificationCursor(value: string): { createdAt: string; id: string } {
	try {
		const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
		if (
			typeof decoded !== "object" ||
			decoded === null ||
			!("createdAt" in decoded) ||
			!("id" in decoded) ||
			typeof decoded.createdAt !== "string" ||
			!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(decoded.createdAt) ||
			decoded.createdAt.startsWith("0000-") ||
			!Number.isFinite(Date.parse(decoded.createdAt)) ||
			new Date(decoded.createdAt).toISOString().slice(0, 19) !== decoded.createdAt.slice(0, 19) ||
			typeof decoded.id !== "string" ||
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.id)
		) {
			throw new Error("Invalid cursor");
		}
		return { createdAt: decoded.createdAt, id: decoded.id };
	} catch {
		throw new UnprocessableEntityException("Mốc phân trang không hợp lệ.");
	}
}
