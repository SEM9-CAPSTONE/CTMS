import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { normalizeStringArray } from "../profiles/dto/normalized-string-array.validator";
import type { PorterRouteProficiency } from "../profiles/entities/porter-route-qualification.entity";
import { PorterVerificationStatus } from "../profiles/entities/porter-verification.entity";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { LevelNotificationsService } from "./level-notifications.service";
import type { RequestEvidence } from "./level-requests.types";
import { levelDossierHash } from "./porter-level-comparison";
import type {
	DecidePorterLevelDto,
	SaveLevelEvidenceDto,
	SaveLevelPolicyDto,
} from "./porter-levels.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { PorterLevelsRepository } from "./porter-levels.repository";
import {
	type LevelDecision,
	LevelDecisionOutcome,
	type LevelDefinition,
	type LevelEvidence,
	type LevelPolicy,
} from "./porter-levels.types";

const HISTORY_SELECT = `SELECT id, qualification_id AS "qualificationId", porter_id AS "porterId",
	 route_id AS "routeId", actor_id AS "actorId", outcome, from_level AS "fromLevel", to_level AS "toLevel",
	 (SELECT full_name FROM users u WHERE u.id=actor_id) AS "actorName",(SELECT name FROM trekking_routes r WHERE r.id=route_id) AS "routeName",
	 reason, policy_snapshot AS "policySnapshot", dossier_snapshot AS "dossierSnapshot",
	 comparison_snapshot AS "comparisonSnapshot",source,request_id AS "requestId",action,from_verified AS "fromVerified",to_verified AS "toVerified",evidence_snapshot AS "evidenceSnapshot",porter_reason AS "porterReason", decided_at AS "decidedAt" FROM porter_level_decisions`;

@Injectable()
export class PorterLevelsService {
	constructor(
		private readonly repository: PorterLevelsRepository,
		private readonly notifications: LevelNotificationsService
	) {}

	policies(): Promise<LevelPolicy[]> {
		return this.repository.policies();
	}
	list(page: number, limit: number) {
		return this.repository.list(page, limit);
	}
	mine(porterId: string) {
		return this.repository.mine(porterId);
	}

	async savePolicy(
		actorId: string,
		level: PorterRouteProficiency,
		dto: SaveLevelPolicyDto
	): Promise<LevelPolicy> {
		return this.repository.dataSource.transaction(async (manager) => {
			await this.repository.requireRole(manager, actorId, UserRole.ADMIN);
			// Serialize even the first insert without assigning any default criteria.
			await manager.query(
				"SELECT pg_advisory_xact_lock(hashtext('porter-level-policy'),hashtext($1))",
				[level]
			);
			const current = await this.repository.policy(manager, level);
			if ((current?.version ?? 0) !== dto.expectedVersion)
				throw new ConflictException("Criteria changed; reload before saving");
			const definition: LevelDefinition = {
				name: dto.name,
				minExperienceYears: dto.minExperienceYears,
				minTimesLed: dto.minTimesLed,
				requiredSkills: normalizeStringArray(dto.requiredSkills),
				requiredCertifications: normalizeStringArray(dto.requiredCertifications),
				responsibilities: dto.responsibilities,
			};
			const rows = (await manager.query(
				`INSERT INTO porter_level_policies(level,definition,version,updated_by)
			 VALUES($1,$2::jsonb,1,$3) ON CONFLICT(level) DO UPDATE SET definition=EXCLUDED.definition,
			 version=porter_level_policies.version+1,updated_by=EXCLUDED.updated_by,updated_at=now()
			 RETURNING level,definition,version,updated_by AS "updatedBy",updated_at AS "updatedAt"`,
				[level, JSON.stringify(definition), actorId]
			)) as LevelPolicy[];
			await this.repository.audit(manager, actorId, "porter_level.policy_updated", actorId, {
				level,
				before: current,
				after: rows[0],
			});
			return rows[0];
		});
	}

	async evidence(porterId: string): Promise<LevelEvidence> {
		const rows = (await this.repository.dataSource.query(
			"SELECT skills,version FROM porter_level_evidence WHERE porter_id=$1",
			[porterId]
		)) as LevelEvidence[];
		return rows[0] ?? { skills: [], version: 0 };
	}

	async saveEvidence(porterId: string, dto: SaveLevelEvidenceDto): Promise<LevelEvidence> {
		return this.repository.dataSource.transaction(async (manager) => {
			await manager.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [porterId]);
			await this.repository.requireRole(manager, porterId, UserRole.PORTER);
			const current = (await manager.query(
				"SELECT version FROM porter_level_evidence WHERE porter_id=$1",
				[porterId]
			)) as Array<{ version: number }>;
			if ((current[0]?.version ?? 0) !== dto.expectedVersion)
				throw new ConflictException("Skills changed; reload before saving");
			const rows = (await manager.query(
				`INSERT INTO porter_level_evidence(porter_id,skills,version)
			 VALUES($1,$2,1) ON CONFLICT(porter_id) DO UPDATE SET skills=EXCLUDED.skills,
			 version=porter_level_evidence.version+1,updated_at=now() RETURNING skills,version`,
				[porterId, normalizeStringArray(dto.skills)]
			)) as LevelEvidence[];
			await this.repository.audit(manager, porterId, "porter_level.skills_updated", porterId, {
				version: rows[0].version,
			});
			return rows[0];
		});
	}

	async comparison(qualificationId: string, level: PorterRouteProficiency) {
		return this.repository.dataSource.transaction(async (manager) => {
			const identity = await this.repository.qualification(manager, qualificationId);
			await this.repository.lockDossier(manager, identity);
			const qualification = await this.repository.qualification(manager, qualificationId);
			const dossier = await this.repository.dossier(manager, qualification);
			const policy = await this.repository.policy(manager, level, true);
			const open = (await manager.query(
				"SELECT id FROM porter_level_requests WHERE qualification_id=$1 AND status IN ('pending','needs_info')",
				[qualificationId]
			)) as Array<{ id: string }>;
			return {
				qualification,
				dossier,
				dossierHash: levelDossierHash(dossier),
				policy,
				comparison: null,
				openRequestId: open[0]?.id ?? null,
			};
		});
	}

	async decide(
		actorId: string,
		qualificationId: string,
		dto: DecidePorterLevelDto
	): Promise<LevelDecision> {
		return this.repository.dataSource.transaction((manager) =>
			this.applyDecision(manager, actorId, qualificationId, dto)
		);
	}

	async applyDecision(
		manager: EntityManager,
		actorId: string,
		qualificationId: string,
		dto: DecidePorterLevelDto,
		request?: { id: string; evidence: RequestEvidence[]; porterReason: string }
	): Promise<LevelDecision> {
		await this.repository.requireRole(manager, actorId, UserRole.ADMIN);
		const identity = await this.repository.qualification(manager, qualificationId);
		if (identity.porterId === actorId)
			throw new ForbiddenException("An Admin cannot review their own Porter level");
		await this.repository.lockDossier(manager, identity);
		await this.repository.requireRole(manager, identity.porterId, UserRole.PORTER);
		const qualification = await this.repository.qualification(manager, qualificationId);
		if (!request) {
			await this.repository.assertNoOpenRequest(manager, qualificationId);
			if (dto.outcome !== LevelDecisionOutcome.APPROVED)
				throw new ConflictException({
					code: "INVALID_DIRECT_ACTION",
					message:
						"Xét cấp trực tiếp chỉ dùng để nâng, hạ hoặc công nhận cấp. Từ chối qua yêu cầu của Porter.",
				});
			if (qualification.verifiedBy && qualification.proficiency === dto.level)
				throw new ConflictException({
					code: "NO_LEVEL_CHANGE",
					message: "Cấp này đã được xác minh, không có thay đổi.",
				});
		}
		const dossier = await this.repository.dossier(manager, qualification);
		const policy = await this.repository.policy(manager, dto.level, true);
		if (!policy)
			throw new ConflictException("Admin must configure the target level criteria before review");
		if (
			qualification.version !== dto.expectedQualificationVersion ||
			policy.version !== dto.expectedPolicyVersion ||
			levelDossierHash(dossier) !== dto.expectedDossierHash
		) {
			throw new ConflictException(
				"Profile, qualification or criteria changed; review the latest evidence again"
			);
		}
		if (
			dto.outcome === LevelDecisionOutcome.APPROVED &&
			dossier.verificationStatus !== PorterVerificationStatus.APPROVED
		) {
			throw new ConflictException(
				"Porter certificate verification must be approved before a level is approved"
			);
		}
		const comparison = null;
		// Deliberately no automatic promotion or threshold gate: Admin makes the decision and gives a reason.
		await manager.query(
			`UPDATE porter_route_qualifications SET
			 proficiency=CASE WHEN $2 THEN $3::porter_route_proficiency ELSE proficiency END,
			 verified_by=CASE WHEN $2 THEN $4::uuid ELSE verified_by END,
			 verified_at=CASE WHEN $2 THEN now() ELSE verified_at END,version=version+1,updated_at=now() WHERE id=$1`,
			[qualificationId, dto.outcome === LevelDecisionOutcome.APPROVED, dto.level, actorId]
		);
		const inserted = (await manager.query(
			`INSERT INTO porter_level_decisions
			 (qualification_id,porter_id,route_id,actor_id,outcome,from_level,to_level,reason,
			 policy_snapshot,dossier_snapshot,comparison_snapshot)
			 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb) RETURNING id`,
			[
				qualificationId,
				identity.porterId,
				identity.routeId,
				actorId,
				dto.outcome,
				qualification.proficiency,
				dto.level,
				dto.reason,
				JSON.stringify(policy),
				JSON.stringify(dossier),
				JSON.stringify(comparison),
			]
		)) as Array<{ id: string }>;
		const rank = { learning: 0, proficient: 1, expert: 2 };
		let action = "recognize";
		if (rank[dto.level] > rank[qualification.proficiency]) action = "upgrade";
		if (rank[dto.level] < rank[qualification.proficiency]) action = "downgrade";
		await manager.query(
			"UPDATE porter_level_decisions SET source=$2,request_id=$3,action=$4,from_verified=$5,to_verified=true,evidence_snapshot=$6::jsonb,porter_reason=$7 WHERE id=$1",
			[
				inserted[0].id,
				request ? "request" : "direct",
				request?.id ?? null,
				action,
				Boolean(qualification.verifiedBy),
				JSON.stringify(request?.evidence ?? []),
				request?.porterReason ?? null,
			]
		);
		await this.notifications.enqueue(manager, identity.porterId, {
			kind: request ? "approved" : action,
			requestId: request?.id,
			qualificationId,
			routeId: identity.routeId,
			routeName: identity.routeName,
			level: dto.level,
			reason: dto.reason,
		});
		await this.repository.audit(manager, actorId, "porter_level.reviewed", inserted[0].id, {
			qualificationId,
			porterId: identity.porterId,
			routeId: identity.routeId,
			outcome: dto.outcome,
			toLevel: dto.level,
			policyVersion: policy.version,
		});
		const rows = (await manager.query(`${HISTORY_SELECT} WHERE id=$1`, [
			inserted[0].id,
		])) as LevelDecision[];
		return rows[0];
	}

	async decisionForRequest(
		manager: EntityManager,
		requestId: string
	): Promise<LevelDecision | null> {
		const rows = (await manager.query(`${HISTORY_SELECT} WHERE request_id=$1`, [
			requestId,
		])) as LevelDecision[];
		return rows[0] ?? null;
	}
	async history(qualificationId: string): Promise<LevelDecision[]> {
		return this.repository.dataSource.query(
			`${HISTORY_SELECT} WHERE qualification_id=$1 ORDER BY decided_at DESC,id DESC LIMIT 100`,
			[qualificationId]
		);
	}
	async ownHistory(porterId: string): Promise<LevelDecision[]> {
		return this.repository.dataSource.query(
			`${HISTORY_SELECT} WHERE porter_id=$1 ORDER BY decided_at DESC,id DESC LIMIT 100`,
			[porterId]
		);
	}
}
