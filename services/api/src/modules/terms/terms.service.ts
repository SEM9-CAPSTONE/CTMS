import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { DataSource } from "typeorm";
import { isUniqueViolation } from "../../shared/database/postgres-error-codes";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { UserRole } from "../users/entities/user.entity";
import type { AcceptTermsDto } from "./dto/accept-terms.dto";
import type { CreateTermsVersionDto, UpdateTermsVersionDto } from "./dto/admin-terms.dto";
import { TermsVersion } from "./entities/terms-version.entity";
import { UserTermsAcceptance } from "./entities/user-terms-acceptance.entity";
import {
	type TermsAcceptanceSource,
	type TermsPlatform,
	type TermsSection,
	normalizeTermsVersion,
} from "./terms-content";
import {
	TERMS_VERSION_OUTDATED_CODE,
	TERMS_VERSION_OUTDATED_MESSAGE,
} from "./terms-registration.helper";

export interface TermsVersionSummaryResponse {
	id: string;
	version: string;
	title: string;
	summary: string | null;
	effectiveDate: string;
	isActive: boolean;
	requiresReconsent: boolean;
	publishedAt: string;
}

export interface TermsVersionDetailResponse extends TermsVersionSummaryResponse {
	sections: TermsSection[];
}

export interface TermsAcceptanceRecordResponse {
	id: string;
	version: string;
	acceptedAt: string;
	source: TermsAcceptanceSource;
	platform: TermsPlatform;
}

export interface MyTermsStatusResponse {
	currentVersion: string;
	currentTitle: string;
	currentEffectiveDate: string;
	currentSummary: string | null;
	requiresReconsent: boolean;
	acceptedCurrentVersion: boolean;
	needsReconsent: boolean;
	latestAcceptance: TermsAcceptanceRecordResponse | null;
	acceptanceHistory: TermsAcceptanceRecordResponse[];
}

export interface AcceptTermsResponse {
	accepted: boolean;
	version: string;
	effectiveDate: string;
	acceptedAt: string;
	alreadyAccepted: boolean;
}

function toSummary(entity: TermsVersion): TermsVersionSummaryResponse {
	return {
		id: entity.id,
		version: entity.version,
		title: entity.title,
		summary: entity.summary,
		effectiveDate: entity.effectiveDate,
		isActive: entity.isActive,
		requiresReconsent: entity.requiresReconsent,
		publishedAt:
			entity.publishedAt instanceof Date
				? entity.publishedAt.toISOString()
				: String(entity.publishedAt),
	};
}

function toDetail(entity: TermsVersion): TermsVersionDetailResponse {
	return {
		...toSummary(entity),
		sections: entity.sections,
	};
}

function toAcceptanceRecord(entity: UserTermsAcceptance): TermsAcceptanceRecordResponse {
	return {
		id: entity.id,
		version: entity.version,
		acceptedAt:
			entity.acceptedAt instanceof Date
				? entity.acceptedAt.toISOString()
				: String(entity.acceptedAt),
		source: entity.source,
		platform: entity.platform,
	};
}

@Injectable()
export class TermsService {
	constructor(private readonly dataSource: DataSource) {}

	async getCurrentVersion(): Promise<TermsVersionDetailResponse> {
		const active = await this.findActiveEntity();
		return toDetail(active);
	}

	async listVersions(): Promise<TermsVersionSummaryResponse[]> {
		const repo = this.dataSource.getRepository(TermsVersion);
		const versions = await repo.find({
			order: {
				isActive: "DESC",
				effectiveDate: "DESC",
				publishedAt: "DESC",
			},
		});
		return versions.map(toSummary);
	}

	async getVersionByCode(rawVersion: string): Promise<TermsVersionDetailResponse> {
		const version = normalizeTermsVersion(rawVersion);
		const repo = this.dataSource.getRepository(TermsVersion);
		const entity = await repo.findOne({ where: { version } });
		if (!entity) {
			throw new NotFoundException("Không tìm thấy phiên bản điều khoản được yêu cầu.");
		}
		return toDetail(entity);
	}

	async getMyStatus(userId: string, roles: readonly string[] = []): Promise<MyTermsStatusResponse> {
		const active = await this.findActiveEntity();
		const isAdmin = roles.includes(UserRole.ADMIN);
		const acceptanceRepo = this.dataSource.getRepository(UserTermsAcceptance);
		const acceptances = await acceptanceRepo.find({
			where: { userId },
			order: { acceptedAt: "DESC" },
		});

		const acceptedCurrentVersion = acceptances.some(
			(item) => item.termsVersionId === active.id || item.version === active.version
		);
		// Admins author and publish terms rather than receiving user re-consent prompts.
		const needsReconsent = !isAdmin && active.requiresReconsent && !acceptedCurrentVersion;
		const acceptanceHistory = acceptances.map(toAcceptanceRecord);

		return {
			currentVersion: active.version,
			currentTitle: active.title,
			currentEffectiveDate: active.effectiveDate,
			currentSummary: active.summary,
			requiresReconsent: active.requiresReconsent,
			acceptedCurrentVersion,
			needsReconsent,
			latestAcceptance: acceptanceHistory[0] ?? null,
			acceptanceHistory,
		};
	}

	async acceptTerms(userId: string, dto: AcceptTermsDto): Promise<AcceptTermsResponse> {
		const requestedVersion = normalizeTermsVersion(dto.version);
		const platform: TermsPlatform = dto.platform ?? "api";

		return this.dataSource.transaction(async (manager) => {
			const termsRepo = manager.getRepository(TermsVersion);
			const acceptanceRepo = manager.getRepository(UserTermsAcceptance);
			const auditLogRepo = manager.getRepository(AuditLog);

			const active = await termsRepo.findOne({
				where: { isActive: true },
				order: { publishedAt: "DESC" },
			});
			if (!active) {
				throw new NotFoundException("Hiện chưa có phiên bản điều khoản đang hiệu lực.");
			}

			if (active.version !== requestedVersion) {
				throw new ConflictException({
					statusCode: 409,
					code: TERMS_VERSION_OUTDATED_CODE,
					message: TERMS_VERSION_OUTDATED_MESSAGE,
					currentVersion: active.version,
					currentEffectiveDate: active.effectiveDate,
				});
			}

			const existing = await acceptanceRepo.findOne({
				where: { userId, termsVersionId: active.id },
			});
			if (existing) {
				return {
					accepted: true,
					version: active.version,
					effectiveDate: active.effectiveDate,
					acceptedAt:
						existing.acceptedAt instanceof Date
							? existing.acceptedAt.toISOString()
							: String(existing.acceptedAt),
					alreadyAccepted: true,
				};
			}

			const acceptedAt = new Date();
			try {
				const saved = await acceptanceRepo.save({
					userId,
					termsVersionId: active.id,
					version: active.version,
					acceptedAt,
					source: "reconsent",
					platform,
				});

				await auditLogRepo.save({
					actorId: userId,
					action: "terms.accepted",
					targetType: "terms_version",
					targetId: active.id,
					before: null,
					after: {
						version: active.version,
						platform,
						source: "reconsent",
						acceptedAt: saved.acceptedAt.toISOString(),
					},
					reason: null,
				});

				return {
					accepted: true,
					version: active.version,
					effectiveDate: active.effectiveDate,
					acceptedAt: saved.acceptedAt.toISOString(),
					alreadyAccepted: false,
				};
			} catch (error) {
				if (isUniqueViolation(error)) {
					const concurrent = await acceptanceRepo.findOne({
						where: { userId, termsVersionId: active.id },
					});
					if (concurrent) {
						return {
							accepted: true,
							version: active.version,
							effectiveDate: active.effectiveDate,
							acceptedAt:
								concurrent.acceptedAt instanceof Date
									? concurrent.acceptedAt.toISOString()
									: String(concurrent.acceptedAt),
							alreadyAccepted: true,
						};
					}
				}
				throw error;
			}
		});
	}

	async publishNewVersion(
		adminUserId: string,
		dto: CreateTermsVersionDto
	): Promise<TermsVersionDetailResponse> {
		const version = normalizeTermsVersion(dto.version);

		return this.dataSource.transaction(async (manager) => {
			const termsRepo = manager.getRepository(TermsVersion);
			const auditLogRepo = manager.getRepository(AuditLog);

			const duplicate = await termsRepo.findOne({ where: { version } });
			if (duplicate) {
				throw new ConflictException(
					`Phiên bản v${version} đã tồn tại. Vui lòng chọn số phiên bản mới.`
				);
			}

			const previousActive = await termsRepo.findOne({ where: { isActive: true } });
			if (previousActive) {
				await termsRepo.update({ id: previousActive.id }, { isActive: false });
			}

			const now = new Date();
			const created = await termsRepo.save({
				version,
				title: dto.title.trim(),
				summary: dto.summary?.trim() || null,
				effectiveDate: dto.effectiveDate,
				sections: dto.sections,
				isActive: true,
				requiresReconsent: dto.requiresReconsent ?? true,
				publishedAt: now,
			});

			await auditLogRepo.save({
				actorId: adminUserId,
				action: "terms.version_published",
				targetType: "terms_version",
				targetId: created.id,
				before: previousActive
					? { id: previousActive.id, version: previousActive.version, isActive: true }
					: null,
				after: {
					version: created.version,
					effectiveDate: created.effectiveDate,
					requiresReconsent: created.requiresReconsent,
					sectionCount: created.sections.length,
				},
				reason: created.summary,
			});

			return toDetail(created);
		});
	}

	async updateVersion(
		adminUserId: string,
		versionId: string,
		dto: UpdateTermsVersionDto
	): Promise<TermsVersionDetailResponse> {
		return this.dataSource.transaction(async (manager) => {
			const termsRepo = manager.getRepository(TermsVersion);
			const auditLogRepo = manager.getRepository(AuditLog);

			const existing = await termsRepo.findOne({ where: { id: versionId } });
			if (!existing) {
				throw new NotFoundException("Không tìm thấy phiên bản điều khoản cần cập nhật.");
			}

			const beforeSnapshot = {
				version: existing.version,
				title: existing.title,
				effectiveDate: existing.effectiveDate,
				requiresReconsent: existing.requiresReconsent,
			};

			if (dto.title !== undefined) existing.title = dto.title.trim();
			if (dto.summary !== undefined) existing.summary = dto.summary?.trim() || null;
			if (dto.effectiveDate !== undefined) existing.effectiveDate = dto.effectiveDate;
			if (dto.sections !== undefined) existing.sections = dto.sections;
			if (dto.requiresReconsent !== undefined) existing.requiresReconsent = dto.requiresReconsent;

			const saved = await termsRepo.save(existing);

			await auditLogRepo.save({
				actorId: adminUserId,
				action: "terms.version_updated",
				targetType: "terms_version",
				targetId: saved.id,
				before: beforeSnapshot,
				after: {
					version: saved.version,
					title: saved.title,
					effectiveDate: saved.effectiveDate,
					requiresReconsent: saved.requiresReconsent,
					sectionCount: saved.sections.length,
				},
				reason: saved.summary,
			});

			return toDetail(saved);
		});
	}

	private async findActiveEntity(): Promise<TermsVersion> {
		const repo = this.dataSource.getRepository(TermsVersion);
		const active = await repo.findOne({
			where: { isActive: true },
			order: { publishedAt: "DESC" },
		});
		if (!active) {
			throw new NotFoundException("Hiện chưa có phiên bản điều khoản đang hiệu lực.");
		}
		return active;
	}
}
