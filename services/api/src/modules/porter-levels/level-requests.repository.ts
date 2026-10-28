import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { EntityManager } from "typeorm";
import {
	LEVEL_REQUEST_SELECT,
	type LevelRequest,
	type LevelRequestStatus,
	REQUEST_EVIDENCE_SELECT,
	type RequestEvent,
	type RequestEvidence,
} from "./level-requests.types";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { PorterLevelsRepository } from "./porter-levels.repository";

export function requestConflict(code: string, message: string): never {
	throw new ConflictException({ code, message });
}
@Injectable()
export class LevelRequestsRepository {
	constructor(readonly levels: PorterLevelsRepository) {}
	get db() {
		return this.levels.dataSource;
	}
	async get(manager: EntityManager, id: string, lock = false): Promise<LevelRequest> {
		const rows = (await manager.query(
			`${LEVEL_REQUEST_SELECT} WHERE x.id=$1 ${lock ? "FOR UPDATE OF x" : ""}`,
			[id]
		)) as LevelRequest[];
		if (!rows[0]) throw new NotFoundException("Không tìm thấy yêu cầu xét cấp.");
		return rows[0];
	}
	owner(request: LevelRequest, actorId: string, admin: boolean): void {
		if (!admin && request.porterId !== actorId)
			throw new ForbiddenException({
				code: "NOT_OWNER",
				message: "Bạn không có quyền xem hoặc sửa yêu cầu này.",
			});
	}
	async lock(
		manager: EntityManager,
		id: string,
		actorId: string,
		admin: boolean
	): Promise<LevelRequest> {
		const identity = await this.get(manager, id);
		this.owner(identity, actorId, admin);
		const qualification = await this.levels.qualification(manager, identity.qualificationId);
		await this.levels.lockDossier(manager, qualification);
		return this.get(manager, id, true);
	}
	checkVersion(request: LevelRequest, version: number): void {
		if (request.version !== version)
			requestConflict("REQUEST_CONFLICT", "Yêu cầu đã thay đổi. Tải lại để xem nội dung mới nhất.");
	}
	checkState(request: LevelRequest, states: LevelRequestStatus[]): void {
		if (!states.includes(request.status))
			requestConflict(
				"INVALID_STATE_TRANSITION",
				"Trạng thái yêu cầu không cho phép thao tác này."
			);
	}
	evidence(manager: EntityManager, id: string): Promise<RequestEvidence[]> {
		return manager.query(`${REQUEST_EVIDENCE_SELECT} WHERE request_id=$1 ORDER BY id`, [id]);
	}
	events(manager: EntityManager, id: string): Promise<RequestEvent[]> {
		return manager.query(
			`SELECT id,actor_id AS "actorId",(SELECT full_name FROM users u WHERE u.id=actor_id) AS "actorName",action,from_status AS "fromStatus",to_status AS "toStatus",reason,snapshot,created_at AS "createdAt" FROM porter_level_request_events WHERE request_id=$1 ORDER BY created_at,id`,
			[id]
		);
	}
	async event(
		manager: EntityManager,
		request: LevelRequest,
		actorId: string,
		action: string,
		from: LevelRequestStatus | null,
		reason: string | null
	): Promise<void> {
		const evidence = await this.evidence(manager, request.id);
		await manager.query(
			"INSERT INTO porter_level_request_events(request_id,actor_id,action,from_status,to_status,reason,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)",
			[
				request.id,
				actorId,
				action,
				from,
				request.status,
				reason,
				JSON.stringify({
					version: request.version,
					reason: request.reason,
					targetLevel: request.targetLevel,
					evidence,
				}),
			]
		);
		await this.levels.audit(manager, actorId, `porter_level.request_${action}`, request.id, {
			status: request.status,
			version: request.version,
		});
	}
	async transition(
		manager: EntityManager,
		request: LevelRequest,
		actorId: string,
		status: LevelRequestStatus,
		reason: string | null,
		admin: boolean
	): Promise<LevelRequest> {
		const rows = (await manager.query(
			"UPDATE porter_level_requests SET status=$2,version=version+1,updated_at=now(),decision_reason=CASE WHEN $6 THEN $3 ELSE decision_reason END,decided_by=CASE WHEN $6 THEN $4::uuid ELSE decided_by END,decided_at=CASE WHEN $6 THEN now() ELSE decided_at END WHERE id=$1 AND version=$5 RETURNING id",
			[request.id, status, reason, actorId, request.version, admin]
		)) as Array<{ id: string }>;
		if (!rows.length)
			requestConflict("INVALID_STATE_TRANSITION", "Yêu cầu đã được xử lý bởi thao tác khác.");
		const updated = await this.get(manager, request.id);
		await this.event(manager, updated, actorId, status, request.status, reason);
		return updated;
	}
}
