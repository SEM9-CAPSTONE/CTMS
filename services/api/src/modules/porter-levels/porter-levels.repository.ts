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
import type { LevelDossier, LevelPolicy, LevelQualification } from "./porter-levels.types";

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

	async list(page: number, limit: number): Promise<{ items: LevelQualification[]; total: number }> {
		const [items, count] = await Promise.all([
			this.dataSource.query(
				`${QUALIFICATION_SELECT} ORDER BY q.created_at, q.id LIMIT $1 OFFSET $2`,
				[limit, (page - 1) * limit]
			) as Promise<LevelQualification[]>,
			this.dataSource.query(
				"SELECT count(*)::int AS total FROM porter_route_qualifications"
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
		return { ...rows[0], timesLed: qualification.timesLed };
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
}
