import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource, type EntityManager } from "typeorm";
import type { PorterRouteProficiency } from "../profiles/entities/porter-route-qualification.entity";
import { type UserRole, UserStatus } from "../users/entities/user.entity";
import type {
	DossierCertificate,
	LevelDossier,
	LevelPolicy,
	LevelQualification,
} from "./porter-levels.types";

const QUALIFICATION_SELECT = `SELECT q.id, q.porter_id AS "porterId", q.route_id AS "routeId",
	q.proficiency, q.times_led AS "timesLed", q.verified_by AS "verifiedBy", q.version,
	u.full_name AS "porterName", r.name AS "routeName"
	FROM porter_route_qualifications q JOIN users u ON u.id=q.porter_id
	JOIN trekking_routes r ON r.id=q.route_id`;

@Injectable()
export class PorterLevelsRepository {
	constructor(readonly dataSource: DataSource) {}

	async assertNoOpenRequest(manager: EntityManager, qualificationId: string): Promise<void> {
		const rows = (await manager.query(
			"SELECT id FROM porter_level_requests WHERE qualification_id=$1 AND status IN ('pending','needs_info')",
			[qualificationId]
		)) as Array<{ id: string }>;
		if (rows[0])
			throw new ConflictException({
				code: "OPEN_REQUEST_EXISTS",
				message: "Đang có yêu cầu chờ xử lý",
				requestId: rows[0].id,
			});
	}

	async requireRole(manager: EntityManager, userId: string, role: UserRole): Promise<void> {
		const rows = (await manager.query(
			`SELECT u.id FROM users u WHERE u.id=$1 AND u.status=$2
		 AND (u.role=$3 OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role=$3))
		 FOR SHARE OF u`,
			[userId, UserStatus.ACTIVE, role]
		)) as Array<{ id: string }>;
		if (!rows.length)
			throw new ForbiddenException("Active account with the required role is required");
	}

	async policies(manager = this.dataSource.manager): Promise<LevelPolicy[]> {
		return manager.query(`SELECT level, definition, version, updated_by AS "updatedBy",
		 updated_at AS "updatedAt" FROM porter_level_policies ORDER BY level`);
	}

	async policy(
		manager: EntityManager,
		level: PorterRouteProficiency,
		lock = false
	): Promise<LevelPolicy | null> {
		const rows = (await manager.query(
			`SELECT level, definition, version, updated_by AS "updatedBy",
		 updated_at AS "updatedAt" FROM porter_level_policies WHERE level=$1 ${lock ? "FOR SHARE" : ""}`,
			[level]
		)) as LevelPolicy[];
		return rows[0] ?? null;
	}

	async list(
		page: number,
		limit: number,
		search = ""
	): Promise<{ items: LevelQualification[]; total: number }> {
		const filter = search.trim().toLocaleLowerCase();
		const where =
			"WHERE ($1='' OR position($1 in lower(u.full_name))>0 OR position($1 in lower(r.name))>0)";
		const [items, count] = await Promise.all([
			this.dataSource.query(
				`${QUALIFICATION_SELECT} ${where} ORDER BY q.created_at,q.id LIMIT $2 OFFSET $3`,
				[filter, limit, (page - 1) * limit]
			) as Promise<LevelQualification[]>,
			this.dataSource.query(
				`SELECT count(*)::int AS total FROM porter_route_qualifications q JOIN users u ON u.id=q.porter_id JOIN trekking_routes r ON r.id=q.route_id ${where}`,
				[filter]
			) as Promise<Array<{ total: number }>>,
		]);
		return { items, total: count[0].total };
	}

	async mine(porterId: string) {
		return this.dataSource.query(
			`SELECT a.*, (SELECT x.id FROM porter_level_requests x WHERE x.qualification_id=a.id AND x.status IN ('pending','needs_info')) AS "openRequestId" FROM (${QUALIFICATION_SELECT} WHERE q.porter_id=$1) a ORDER BY a."routeName"`,
			[porterId]
		) as Promise<Array<LevelQualification & { openRequestId: string | null }>>;
	}
	async qualification(manager: EntityManager, id: string): Promise<LevelQualification> {
		const rows = (await manager.query(`${QUALIFICATION_SELECT} WHERE q.id=$1`, [
			id,
		])) as LevelQualification[];
		if (!rows[0]) throw new NotFoundException("Porter Route qualification not found");
		return rows[0];
	}

	async lockDossier(manager: EntityManager, identity: LevelQualification): Promise<void> {
		// Match the Route -> Porter -> profile -> qualification lock order of the existing claim workflow.
		await manager.query("SELECT id FROM trekking_routes WHERE id=$1 FOR UPDATE", [
			identity.routeId,
		]);
		await manager.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [identity.porterId]);
		await manager.query("SELECT porter_id FROM porter_profiles WHERE porter_id=$1 FOR UPDATE", [
			identity.porterId,
		]);
		await manager.query(
			"SELECT porter_id FROM porter_level_evidence WHERE porter_id=$1 FOR UPDATE",
			[identity.porterId]
		);
		await manager.query("SELECT porter_id FROM porter_verifications WHERE porter_id=$1 FOR SHARE", [
			identity.porterId,
		]);
		await manager.query("SELECT id FROM porter_route_qualifications WHERE id=$1 FOR UPDATE", [
			identity.id,
		]);
	}

	async dossier(manager: EntityManager, qualification: LevelQualification): Promise<LevelDossier> {
		const rows = (await manager.query(
			`SELECT p.porter_id AS "porterId", u.full_name AS "porterName",
		 p.version AS "profileVersion", p.experience_years AS "experienceYears", p.certifications,
		 COALESCE(e.skills, ARRAY[]::text[]) AS skills, COALESCE(e.version,0) AS "evidenceVersion",
		 v.status AS "verificationStatus", v.updated_at AS "verificationUpdatedAt"
		 FROM porter_profiles p JOIN users u ON u.id=p.porter_id
		 LEFT JOIN porter_level_evidence e ON e.porter_id=p.porter_id
		 LEFT JOIN porter_verifications v ON v.porter_id=p.porter_id WHERE p.porter_id=$1`,
			[qualification.porterId]
		)) as Omit<LevelDossier, "timesLed">[];
		if (!rows[0]) throw new NotFoundException("Porter profile not found");

		let certRows: DossierCertificate[] = [];
		try {
			certRows = (await manager.query(
				`SELECT id, type, name, status, expiry_date AS "expiryDate", rejection_reason AS "rejectionReason"
				 FROM porter_certificates
				 WHERE porter_id = $1 AND deleted_at IS NULL`,
				[qualification.porterId]
			)) as DossierCertificate[];
		} catch {
			certRows = [];
		}

		return { ...rows[0], certificates: certRows, timesLed: qualification.timesLed };
	}

	async audit(
		manager: EntityManager,
		actorId: string,
		action: string,
		targetId: string,
		after: Record<string, unknown>
	): Promise<void> {
		await manager.query(
			`INSERT INTO audit_logs(actor_id,action,target_type,target_id,after,reason)
		 VALUES($1,$2,'porter_level',$3,$4::jsonb,'manual_porter_level_review')`,
			[actorId, action, targetId, JSON.stringify(after)]
		);
	}

	async getGlobalPorterRow(porterId: string): Promise<{
		porterId: string;
		porterName: string;
		porterEmail: string;
		currentLevel: PorterRouteProficiency;
		levelVerifiedAt: Date | null;
		profileVersion: number;
		experienceYears: number;
		certifications: string[];
		skills: string[];
		evidenceVersion: number;
		verificationStatus: string | null;
		verificationUpdatedAt: Date | null;
		completedTrips: number;
		totalKmLed: number;
		averageRating: number;
		reviewCount: number;
		distinctRoutesCount: number;
		certificates: DossierCertificate[];
	} | null> {
		const rows = (await this.dataSource.query(
			`SELECT
				u.id AS "porterId",
				u.full_name AS "porterName",
				u.email AS "porterEmail",
				COALESCE(p.porter_level, 'learning'::porter_route_proficiency) AS "currentLevel",
				p.level_verified_at AS "levelVerifiedAt",
				COALESCE(p.version, 0) AS "profileVersion",
				COALESCE(p.experience_years, 0) AS "experienceYears",
				COALESCE(p.certifications, ARRAY[]::text[]) AS certifications,
				COALESCE(e.skills, ARRAY[]::text[]) AS skills,
				COALESCE(e.version, 0) AS "evidenceVersion",
				v.status AS "verificationStatus",
				v.updated_at AS "verificationUpdatedAt",
				GREATEST(COALESCE(p.completed_trips, 0), COALESCE(trip_stats.completed_trips, 0))::int AS "completedTrips",
				CASE
					WHEN COALESCE(trip_stats.total_km, 0) > 0 THEN COALESCE(trip_stats.total_km, 0)::float8
					WHEN COALESCE(p.completed_trips, 0) > 0 THEN ROUND((p.completed_trips * 8.5)::numeric, 1)::float8
					ELSE 0::float8
				END AS "totalKmLed",
				COALESCE(trip_stats.distinct_routes, 0)::int AS "distinctRoutesCount",
				COALESCE(rev_stats.avg_rating, p.rating_avg, 0)::float8 AS "averageRating",
				COALESCE(rev_stats.review_count, 0)::int AS "reviewCount"
			 FROM users u
			 LEFT JOIN porter_profiles p ON p.porter_id = u.id
			 LEFT JOIN porter_level_evidence e ON e.porter_id = u.id
			 LEFT JOIN porter_verifications v ON v.porter_id = u.id
			 LEFT JOIN LATERAL (
				SELECT
					COUNT(DISTINCT t.id) AS completed_trips,
					COALESCE(SUM(COALESCE(r.length_meters, 0)) / 1000.0, 0) AS total_km,
					COUNT(DISTINCT t.route_id) AS distinct_routes
				FROM trip_porters tp
				JOIN trips t ON t.id = tp.trip_id AND t.status = 'completed'
				LEFT JOIN trekking_routes r ON r.id = t.route_id
				WHERE tp.porter_id = u.id
				  AND tp.status = 'assigned'
				  AND EXISTS (
					SELECT 1 FROM porter_requests pr
					WHERE pr.trip_id = tp.trip_id
					  AND pr.porter_id = tp.porter_id
					  AND pr.status = 'accepted'
					  AND pr.requested_role = 'lead'
				  )
			 ) trip_stats ON true
			 LEFT JOIN LATERAL (
				SELECT
					ROUND(AVG(pr.rating)::numeric, 2) AS avg_rating,
					COUNT(pr.id) AS review_count
				FROM porter_reviews pr
				WHERE pr.porter_id = u.id
			 ) rev_stats ON true
			 WHERE u.id = $1`,
			[porterId]
		)) as Array<{
			porterId: string;
			porterName: string;
			porterEmail: string;
			currentLevel: PorterRouteProficiency;
			levelVerifiedAt: Date | null;
			profileVersion: number;
			experienceYears: number;
			certifications: string[];
			skills: string[];
			evidenceVersion: number;
			verificationStatus: string | null;
			verificationUpdatedAt: Date | null;
			completedTrips: number;
			totalKmLed: number;
			averageRating: number;
			reviewCount: number;
			distinctRoutesCount: number;
		}>;

		if (!rows[0]) return null;

		let certRows: DossierCertificate[] = [];
		try {
			certRows = (await this.dataSource.query(
				`SELECT id, type, name, status, expiry_date AS "expiryDate", rejection_reason AS "rejectionReason"
				 FROM porter_certificates
				 WHERE porter_id = $1 AND deleted_at IS NULL
				 ORDER BY created_at DESC`,
				[porterId]
			)) as DossierCertificate[];
		} catch {
			certRows = [];
		}

		return {
			...rows[0],
			totalKmLed: Number(Number(rows[0].totalKmLed ?? 0).toFixed(1)),
			averageRating: Number(Number(rows[0].averageRating ?? 0).toFixed(1)),
			certificates: certRows,
		};
	}

	async listGlobalPorterIds(
		page: number,
		limit: number,
		search = ""
	): Promise<{ ids: string[]; total: number }> {
		const filter = search.trim().toLocaleLowerCase();
		const where = `
			WHERE u.status = 'active'
			  AND (u.role = 'porter' OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'porter'))
			  AND ($1 = '' OR position($1 in lower(u.full_name)) > 0 OR position($1 in lower(u.email)) > 0)
		`;

		const [rows, countRows] = await Promise.all([
			this.dataSource.query(
				`SELECT u.id
				 FROM users u
				 LEFT JOIN porter_profiles p ON p.porter_id = u.id
				 ${where}
				 ORDER BY COALESCE(p.completed_trips, 0) DESC, u.full_name ASC
				 LIMIT $2 OFFSET $3`,
				[filter, limit, (page - 1) * limit]
			) as Promise<Array<{ id: string }>>,
			this.dataSource.query(`SELECT count(*)::int AS total FROM users u ${where}`, [
				filter,
			]) as Promise<Array<{ total: number }>>,
		]);

		return {
			ids: rows.map((r) => r.id),
			total: countRows[0]?.total ?? 0,
		};
	}
}
