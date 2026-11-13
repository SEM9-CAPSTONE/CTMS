import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { UserRole } from "../../users/entities/user.entity";
import {
	type PorterVerification,
	PorterVerificationStatus,
} from "../entities/porter-verification.entity";

export interface PorterVerificationListFilters {
	status?: PorterVerificationStatus;
	search?: string;
	page: number;
	limit: number;
}

export interface PorterVerificationListRow {
	porterId: string;
	fullName: string | null;
	email: string | null;
	phone: string | null;
	status: PorterVerificationStatus;
	submittedAt: Date | null;
	reviewedAt: Date | null;
	documentCount: number;
}

export interface PorterVerificationContact {
	porterId: string;
	fullName: string | null;
	email: string | null;
	phone: string | null;
	experienceYears: number | null;
	certifications: string[];
}

/** Today in Vietnam, as the guide card's "valid through" date is a calendar date. */
const VIETNAM_TODAY_SQL = `(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;

/**
 * SQL predicate (users aliased as `candidate`) that is true only for Porters whose document
 * verification has been approved by an Admin and whose guide card has not expired. Porters approved
 * before guide cards existed have no card on file and stay eligible (transition, see ctms-01 §16).
 */
export const APPROVED_PORTER_VERIFICATION_SQL = `EXISTS (
	SELECT 1 FROM "porter_verifications" verification
	WHERE verification."porter_id" = candidate."id"
	  AND verification."status" = '${PorterVerificationStatus.APPROVED}'
	  AND (verification."guide_card_expires_on" IS NULL OR verification."guide_card_expires_on" >= ${VIETNAM_TODAY_SQL})
)`;

const PORTER_ROLE_SQL = `(
	EXISTS (
		SELECT 1 FROM "user_roles" granted_role
		WHERE granted_role."user_id" = candidate."id" AND granted_role."role" = '${UserRole.PORTER}'
	)
	OR (
		NOT EXISTS (SELECT 1 FROM "user_roles" any_role WHERE any_role."user_id" = candidate."id")
		AND candidate."role" = '${UserRole.PORTER}'
	)
)`;

@Injectable()
export class PorterVerificationsRepository extends Repository<PorterVerification> {
	findByPorterId(porterId: string): Promise<PorterVerification | null> {
		return this.findOneBy({ porterId });
	}

	findByPorterIdForUpdate(porterId: string): Promise<PorterVerification | null> {
		return this.createQueryBuilder("verification")
			.where("verification.porterId = :porterId", { porterId })
			.setLock("pessimistic_write")
			.getOne();
	}

	async ensureExists(porterId: string): Promise<void> {
		await this.query(
			`INSERT INTO "porter_verifications" ("porter_id") VALUES ($1) ON CONFLICT DO NOTHING`,
			[porterId]
		);
	}

	/** Approved and, when a guide card is on file, not expired (same rule as the SQL predicate). */
	async isApproved(porterId: string): Promise<boolean> {
		const rows = (await this.query(
			`SELECT 1 FROM "porter_verifications" verification
			 WHERE verification."porter_id" = $1
			   AND verification."status" = '${PorterVerificationStatus.APPROVED}'
			   AND (verification."guide_card_expires_on" IS NULL OR verification."guide_card_expires_on" >= ${VIETNAM_TODAY_SQL})`,
			[porterId]
		)) as unknown[];
		return rows.length > 0;
	}

	async countPendingReview(): Promise<number> {
		const rows = (await this.query(
			`SELECT COUNT(*) AS "total"
			FROM "porter_verifications" verification
			JOIN "users" candidate ON candidate."id" = verification."porter_id"
			WHERE verification."status" = $1 AND ${PORTER_ROLE_SQL}`,
			[PorterVerificationStatus.PENDING_REVIEW]
		)) as Array<{ total: string }>;
		return Number(rows[0]?.total ?? 0);
	}

	async listForAdmin(
		filters: PorterVerificationListFilters
	): Promise<{ items: PorterVerificationListRow[]; total: number }> {
		const parameters: unknown[] = [];
		const conditions = [PORTER_ROLE_SQL];

		if (filters.status) {
			parameters.push(filters.status);
			conditions.push(
				`COALESCE(verification."status", '${PorterVerificationStatus.PENDING_DOCUMENTS}') = $${parameters.length}`
			);
		}
		if (filters.search) {
			parameters.push(`%${escapeLike(filters.search)}%`);
			const p = `$${parameters.length}`;
			conditions.push(
				`(candidate."full_name" ILIKE ${p} OR candidate."email" ILIKE ${p} OR candidate."phone" ILIKE ${p})`
			);
		}

		const fromClause = `
			FROM "users" candidate
			LEFT JOIN "porter_verifications" verification ON verification."porter_id" = candidate."id"`;
		const whereClause = `WHERE ${conditions.join(" AND ")}`;

		const countRows = (await this.query(
			`SELECT COUNT(*)::int AS "total" ${fromClause} ${whereClause}`,
			parameters
		)) as Array<{ total: number | string }>;

		const listParameters = [...parameters, filters.limit, (filters.page - 1) * filters.limit];
		const rows = (await this.query(
			`SELECT
				candidate."id" AS "porterId",
				candidate."full_name" AS "fullName",
				candidate."email" AS "email",
				candidate."phone" AS "phone",
				COALESCE(verification."status", '${PorterVerificationStatus.PENDING_DOCUMENTS}') AS "status",
				verification."submitted_at" AS "submittedAt",
				verification."reviewed_at" AS "reviewedAt",
				(
					SELECT COUNT(*)::int FROM "porter_verification_documents" document
					WHERE document."porter_id" = candidate."id"
				) AS "documentCount"
			 ${fromClause}
			 ${whereClause}
			 ORDER BY
				(COALESCE(verification."status", '${PorterVerificationStatus.PENDING_DOCUMENTS}') = '${PorterVerificationStatus.PENDING_REVIEW}') DESC,
				verification."submitted_at" ASC NULLS LAST,
				candidate."created_at" DESC,
				candidate."id" ASC
			 LIMIT $${listParameters.length - 1} OFFSET $${listParameters.length}`,
			listParameters
		)) as PorterVerificationListRow[];

		return {
			items: rows.map((row) => ({ ...row, documentCount: Number(row.documentCount) })),
			total: Number(countRows[0]?.total ?? 0),
		};
	}

	async findContact(porterId: string): Promise<PorterVerificationContact | null> {
		const rows = (await this.query(
			`SELECT
				candidate."id" AS "porterId",
				candidate."full_name" AS "fullName",
				candidate."email" AS "email",
				candidate."phone" AS "phone",
				profile."experience_years" AS "experienceYears",
				COALESCE(profile."certifications", '{}') AS "certifications"
			 FROM "users" candidate
			 LEFT JOIN "porter_profiles" profile ON profile."porter_id" = candidate."id"
			 WHERE candidate."id" = $1 AND ${PORTER_ROLE_SQL}`,
			[porterId]
		)) as PorterVerificationContact[];
		const row = rows[0];
		if (!row) return null;
		return {
			...row,
			experienceYears: row.experienceYears === null ? null : Number(row.experienceYears),
		};
	}
}

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
