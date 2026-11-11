import { createHash } from "node:crypto";
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { LevelNotificationsService } from "./level-notifications.service";
// biome-ignore lint/style/useImportType: Nest injection metadata
import {
	LEVEL_EVIDENCE_MAX_COUNT,
	LevelRequestFilesService,
	type StoredLevelFile,
} from "./level-request-files.service";
import type {
	ApproveLevelRequestDto,
	CreateLevelRequestDto,
	ListLevelRequestsDto,
	ResubmitLevelRequestDto,
	ReviewLevelRequestDto,
} from "./level-requests.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { LevelRequestsRepository, requestConflict } from "./level-requests.repository";
import {
	LEVEL_REQUEST_SELECT,
	type LevelRequest,
	LevelRequestStatus,
} from "./level-requests.types";
import { levelDossierHash } from "./porter-level-comparison";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { PorterLevelsService } from "./porter-levels.service";
import { LevelDecisionOutcome } from "./porter-levels.types";

const ranks = { learning: 0, proficient: 1, expert: 2 };
@Injectable()
export class LevelRequestsService {
	constructor(
		private readonly repo: LevelRequestsRepository,
		private readonly files: LevelRequestFilesService,
		private readonly levels: PorterLevelsService,
		private readonly notifications: LevelNotificationsService
	) {}
	async list(actorId: string, admin: boolean, dto: ListLevelRequestsDto) {
		const params: unknown[] = [];
		const clauses: string[] = [];
		const filter = (column: string, value: unknown) => {
			if (value !== undefined) {
				params.push(value);
				clauses.push(`${column}=$${params.length}`);
			}
		};
		filter("x.porter_id", admin ? dto.porterId : actorId);
		filter("x.route_id", dto.routeId);
		filter("x.status", dto.status);
		if (dto.search?.trim()) {
			params.push(`%${dto.search.trim().replace(/[\\%_]/g, "\\$&")}%`);
			clauses.push(`(u.full_name ILIKE $${params.length} OR r.name ILIKE $${params.length})`);
		}
		const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
		const count = (await this.repo.db.query(
			`SELECT count(*)::int AS total FROM porter_level_requests x JOIN users u ON u.id=x.porter_id JOIN trekking_routes r ON r.id=x.route_id${where}`,
			params
		)) as Array<{ total: number }>;
		const items = (await this.repo.db.query(
			`${LEVEL_REQUEST_SELECT}${where} ORDER BY x.created_at DESC,x.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
			[...params, dto.limit, (dto.page - 1) * dto.limit]
		)) as LevelRequest[];
		return { items, total: count[0].total };
	}
	async detail(actorId: string, admin: boolean, id: string) {
		return this.repo.db.transaction(async (manager) => {
			const request = await this.repo.lock(manager, id, actorId, admin);
			const qualification = await this.repo.levels.qualification(manager, request.qualificationId);
			const dossier = await this.repo.levels.dossier(manager, qualification);
			const policy = await this.repo.levels.policy(manager, request.targetLevel, true);
			return {
				request,
				qualification,
				dossier,
				policy,
				dossierHash: levelDossierHash(dossier),
				comparison: null,
				decision: await this.levels.decisionForRequest(manager, id),
				evidence: await this.repo.evidence(manager, id),
				events: await this.repo.events(manager, id),
			};
		});
	}
	private async fingerprint(manager: EntityManager, request: LevelRequest): Promise<string> {
		const qualification = await this.repo.levels.qualification(manager, request.qualificationId);
		const dossier = await this.repo.levels.dossier(manager, qualification);
		const evidence = (await this.repo.evidence(manager, request.id))
			.filter((item) => !item.removedAt)
			.map((item) => item.checksum)
			.sort();
		return createHash("sha256")
			.update(JSON.stringify({ reason: request.reason, dossier, evidence }))
			.digest("hex");
	}
	private async attach(
		manager: EntityManager,
		requestId: string,
		uploads: Express.Multer.File[],
		written: StoredLevelFile[]
	): Promise<void> {
		const active = (await this.repo.evidence(manager, requestId)).filter((item) => !item.removedAt);
		if (active.length + uploads.length > LEVEL_EVIDENCE_MAX_COUNT)
			throw new UnprocessableEntityException("Tối đa 5 tệp minh chứng cho mỗi yêu cầu.");
		for (const upload of uploads) {
			const file = await this.files.store(upload);
			written.push(file);
			await manager.query(
				"INSERT INTO porter_level_request_evidence(request_id,file_ref,file_name,mime_type,size,checksum) VALUES($1,$2,$3,$4,$5,$6)",
				[requestId, file.fileRef, file.fileName, file.mimeType, file.size, file.checksum]
			);
		}
	}
	async create(actorId: string, dto: CreateLevelRequestDto, uploads: Express.Multer.File[]) {
		const written: StoredLevelFile[] = [];
		try {
			return await this.repo.db.transaction(async (manager) => {
				const ids = (await manager.query(
					"SELECT id FROM porter_route_qualifications WHERE porter_id=$1 AND route_id=$2",
					[actorId, dto.routeId]
				)) as Array<{ id: string }>;
				if (!ids[0])
					throw new NotFoundException({
						code: "QUALIFICATION_NOT_FOUND",
						message: "Bạn cần khai báo năng lực trên tuyến trước khi yêu cầu nâng cấp.",
					});
				const identity = await this.repo.levels.qualification(manager, ids[0].id);
				await this.repo.levels.lockDossier(manager, identity);
				await this.repo.levels.requireRole(manager, actorId, UserRole.PORTER);
				const qualification = await this.repo.levels.qualification(manager, identity.id);
				await this.repo.levels.assertNoOpenRequest(manager, identity.id);
				if (qualification.version !== dto.expectedQualificationVersion)
					requestConflict(
						"LEVEL_CONFLICT",
						"Năng lực trên tuyến đã thay đổi. Tải lại trước khi gửi."
					);
				if (ranks[dto.targetLevel] <= ranks[qualification.proficiency])
					requestConflict("INVALID_TARGET_LEVEL", "Chỉ được yêu cầu cấp cao hơn cấp hiện tại.");
				const rows = (await manager.query(
					`INSERT INTO porter_level_requests(qualification_id,porter_id,route_id,current_level,current_verified,target_level,reason,submission_hash) VALUES($1,$2,$3,$4,$5,$6,$7,'') RETURNING id`,
					[
						identity.id,
						actorId,
						dto.routeId,
						qualification.proficiency,
						Boolean(qualification.verifiedBy),
						dto.targetLevel,
						dto.reason,
					]
				)) as Array<{ id: string }>;
				let request = await this.repo.get(manager, rows[0].id);
				await this.attach(manager, request.id, uploads, written);
				const hash = await this.fingerprint(manager, request);
				const previous = (await manager.query(
					"SELECT submission_hash FROM porter_level_requests WHERE qualification_id=$1 AND target_level=$2 AND status='rejected' ORDER BY created_at DESC LIMIT 1",
					[identity.id, dto.targetLevel]
				)) as Array<{ submission_hash: string }>;
				if (previous[0]?.submission_hash === hash)
					requestConflict(
						"NO_REQUEST_CHANGES",
						"Cần cập nhật lý do, hồ sơ hoặc minh chứng so với yêu cầu đã bị từ chối."
					);
				await manager.query("UPDATE porter_level_requests SET submission_hash=$2 WHERE id=$1", [
					request.id,
					hash,
				]);
				request = await this.repo.get(manager, request.id);
				await this.repo.event(manager, request, actorId, "created", null, dto.reason);
				return request;
			});
		} catch (error) {
			await this.files.rollback(written);
			throw error;
		}
	}
	async cancel(actorId: string, id: string, version: number) {
		return this.repo.db.transaction(async (manager) => {
			const request = await this.repo.lock(manager, id, actorId, false);
			this.repo.checkState(request, [LevelRequestStatus.PENDING, LevelRequestStatus.NEEDS_INFO]);
			this.repo.checkVersion(request, version);
			return this.repo.transition(
				manager,
				request,
				actorId,
				LevelRequestStatus.CANCELLED,
				null,
				false
			);
		});
	}
	async resubmit(actorId: string, id: string, dto: ResubmitLevelRequestDto) {
		return this.repo.db.transaction(async (manager) => {
			const request = await this.repo.lock(manager, id, actorId, false);
			this.repo.checkState(request, [LevelRequestStatus.NEEDS_INFO]);
			this.repo.checkVersion(request, dto.expectedVersion);
			request.reason = dto.reason;
			const hash = await this.fingerprint(manager, request);
			if (hash === request.submissionHash)
				requestConflict(
					"NO_REQUEST_CHANGES",
					"Cần cập nhật lý do, hồ sơ hoặc minh chứng trước khi gửi lại."
				);
			await manager.query(
				"UPDATE porter_level_requests SET reason=$2,submission_hash=$3 WHERE id=$1",
				[id, dto.reason, hash]
			);
			return this.repo.transition(
				manager,
				request,
				actorId,
				LevelRequestStatus.PENDING,
				null,
				false
			);
		});
	}
	async addEvidence(actorId: string, id: string, version: number, uploads: Express.Multer.File[]) {
		const written: StoredLevelFile[] = [];
		try {
			return await this.repo.db.transaction(async (manager) => {
				const request = await this.repo.lock(manager, id, actorId, false);
				this.repo.checkState(request, [LevelRequestStatus.NEEDS_INFO]);
				this.repo.checkVersion(request, version);
				if (!uploads.length)
					throw new UnprocessableEntityException("Vui lòng chọn tệp minh chứng.");
				await this.attach(manager, id, uploads, written);
				return this.repo.transition(manager, request, actorId, request.status, null, false);
			});
		} catch (error) {
			await this.files.rollback(written);
			throw error;
		}
	}
	async removeEvidence(actorId: string, id: string, evidenceId: string, version: number) {
		return this.repo.db.transaction(async (manager) => {
			const request = await this.repo.lock(manager, id, actorId, false);
			this.repo.checkState(request, [LevelRequestStatus.NEEDS_INFO]);
			this.repo.checkVersion(request, version);
			const file = (await this.repo.evidence(manager, id)).find(
				(item) => item.id === evidenceId && !item.removedAt
			);
			if (!file) throw new NotFoundException("Không tìm thấy minh chứng đang sử dụng.");
			await manager.query("UPDATE porter_level_request_evidence SET removed_at=now() WHERE id=$1", [
				evidenceId,
			]);
			return this.repo.transition(manager, request, actorId, request.status, null, false);
		});
	}
	async review(
		actorId: string,
		id: string,
		status: LevelRequestStatus.REJECTED | LevelRequestStatus.NEEDS_INFO,
		dto: ReviewLevelRequestDto
	) {
		return this.repo.db.transaction(async (manager) => {
			const request = await this.repo.lock(manager, id, actorId, true);
			await this.repo.levels.requireRole(manager, actorId, UserRole.ADMIN);
			if (actorId === request.porterId)
				throw new ForbiddenException("Admin không được tự xét yêu cầu của mình.");
			this.repo.checkState(
				request,
				status === LevelRequestStatus.NEEDS_INFO
					? [LevelRequestStatus.PENDING]
					: [LevelRequestStatus.PENDING, LevelRequestStatus.NEEDS_INFO]
			);
			this.repo.checkVersion(request, dto.expectedVersion);
			const updated = await this.repo.transition(
				manager,
				request,
				actorId,
				status,
				dto.reason,
				true
			);
			await this.notifications.enqueue(manager, request.porterId, {
				kind: status,
				requestId: id,
				qualificationId: request.qualificationId,
				routeId: request.routeId,
				routeName: request.routeName,
				level: request.targetLevel,
				reason: dto.reason,
			});
			return updated;
		});
	}
	async approve(actorId: string, id: string, dto: ApproveLevelRequestDto) {
		return this.repo.db.transaction(async (manager) => {
			const request = await this.repo.lock(manager, id, actorId, true);
			this.repo.checkState(request, [LevelRequestStatus.PENDING]);
			this.repo.checkVersion(request, dto.expectedVersion);
			const qualification = await this.repo.levels.qualification(manager, request.qualificationId);
			if (
				qualification.proficiency !== request.currentLevel ||
				Boolean(qualification.verifiedBy) !== request.currentVerified
			)
				requestConflict(
					"LEVEL_CONFLICT",
					"Cấp hoặc trạng thái xác minh đã thay đổi so với lúc gửi."
				);
			if (ranks[request.targetLevel] <= ranks[qualification.proficiency])
				requestConflict("INVALID_TARGET_LEVEL", "Cấp đề xuất không còn cao hơn cấp hiện tại.");
			const evidence = (await this.repo.evidence(manager, id)).filter((item) => !item.removedAt);
			await this.levels.applyDecision(
				manager,
				actorId,
				request.qualificationId,
				{ ...dto, level: request.targetLevel, outcome: LevelDecisionOutcome.APPROVED },
				{ id, evidence, porterReason: request.reason }
			);
			return this.repo.transition(
				manager,
				request,
				actorId,
				LevelRequestStatus.APPROVED,
				dto.reason,
				true
			);
		});
	}
	async download(actorId: string, admin: boolean, id: string, evidenceId: string) {
		const request = await this.repo.get(this.repo.db.manager, id);
		this.repo.owner(request, actorId, admin);
		const evidence = (await this.repo.evidence(this.repo.db.manager, id)).find(
			(item) => item.id === evidenceId
		);
		if (!evidence) throw new NotFoundException("Không tìm thấy minh chứng.");
		return { file: evidence, buffer: await this.files.read(evidence) };
	}
}
