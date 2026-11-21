import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { CreateContentReportDto } from "./dto/create-content-report.dto";
import type { StoredSubmission } from "./report-submission.types";

const SUBMISSION_COLUMNS = `id, report_type AS "reportType", target_type AS "targetType",
	target_id AS "targetId", reason AS description, status, created_at AS "createdAt",
	updated_at AS "updatedAt", request_hash AS "requestHash"`;

@Injectable()
export class ReportSubmissionRepository {
	async findByKey(
		manager: EntityManager,
		actorId: string,
		key: string
	): Promise<StoredSubmission | null> {
		const rows: StoredSubmission[] = await manager.query(
			`SELECT ${SUBMISSION_COLUMNS} FROM content_reports WHERE reporter_id=$1 AND idempotency_key=$2`,
			[actorId, key]
		);
		return rows[0] ?? null;
	}

	async canReportReview(
		manager: EntityManager,
		actorId: string,
		targetId: string,
		isHost: boolean,
		isCamper: boolean
	): Promise<boolean> {
		// Lock the source identity and Trip ownership until submission commits.
		const rows: Array<{ tripId: string; hostId: string; reviewerId: string }> = await manager.query(
			`SELECT r.trip_id AS "tripId", t.host_id AS "hostId", r.reviewer_id AS "reviewerId"
			 FROM trip_reviews r JOIN trips t ON t.id=r.trip_id WHERE r.id=$1 FOR SHARE OF r,t`,
			[targetId]
		);
		const review = rows[0];
		if (!review || review.reviewerId === actorId) return false;
		if (isHost && review.hostId === actorId) return true;
		if (!isCamper) return false;
		const members: Array<{ id: string }> = await manager.query(
			`SELECT m.id FROM booking_members m JOIN bookings b ON b.id=m.booking_id
			 WHERE b.trip_id=$1 AND m.user_id=$2 AND m.member_status=$3 AND m.left_at IS NULL
			 FOR SHARE OF m`,
			[review.tripId, actorId, BookingMemberStatus.JOINED]
		);
		return members.length > 0;
	}

	async insert(
		manager: EntityManager,
		actorId: string,
		dto: CreateContentReportDto,
		requestHash: string
	): Promise<StoredSubmission> {
		const rows: StoredSubmission[] = await manager.query(
			`INSERT INTO content_reports(reporter_id,report_type,target_type,target_id,reason,idempotency_key,request_hash)
			 VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${SUBMISSION_COLUMNS}`,
			[
				actorId,
				dto.reportType,
				dto.targetType,
				dto.targetId,
				dto.description,
				dto.idempotencyKey,
				requestHash,
			]
		);
		return rows[0];
	}

	async own(manager: EntityManager, actorId: string, id: string): Promise<StoredSubmission | null> {
		const rows: StoredSubmission[] = await manager.query(
			`SELECT ${SUBMISSION_COLUMNS} FROM content_reports WHERE reporter_id=$1 AND id=$2 AND idempotency_key IS NOT NULL`,
			[actorId, id]
		);
		return rows[0] ?? null;
	}

	async listOwn(
		manager: EntityManager,
		actorId: string,
		page: number,
		limit: number
	): Promise<{
		items: StoredSubmission[];
		total: number;
	}> {
		const items: StoredSubmission[] = await manager.query(
			`SELECT ${SUBMISSION_COLUMNS} FROM content_reports WHERE reporter_id=$1 AND idempotency_key IS NOT NULL
			 ORDER BY created_at DESC,id DESC OFFSET $2 LIMIT $3`,
			[actorId, (page - 1) * limit, limit]
		);
		const [count]: Array<{ total: number }> = await manager.query(
			"SELECT count(*)::int AS total FROM content_reports WHERE reporter_id=$1 AND idempotency_key IS NOT NULL",
			[actorId]
		);
		return { items, total: count.total };
	}
}
