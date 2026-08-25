import { mkdir, rename, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import {
	CAMPSITE_PENDING_UPLOAD_PUBLIC_PATH,
	CAMPSITE_UPLOAD_PUBLIC_PATH,
	getCampsitePendingUploadDir,
	getCampsiteUploadDir,
} from "../../../shared/uploads/upload-paths";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { type CampsiteResponseDto, toCampsiteResponse } from "../dto/campsite-response.dto";
import {
	type PaginatedCampsiteSearchResponseDto,
	toCampsiteSearchItem,
} from "../dto/campsite-search-result.dto";
import type { CreateCampsiteDto } from "../dto/create-campsite.dto";
import { ReviewCampsiteAction, type ReviewCampsiteDto } from "../dto/review-campsite.dto";
import type { SearchCampsitesQueryDto } from "../dto/search-campsites-query.dto";
import type { UpdateCampsiteMediaDto } from "../dto/update-campsite-media.dto";
import type { UpdateCampsiteDto } from "../dto/update-campsite.dto";
import { CampsiteMedia } from "../entities/campsite-media.entity";
import { CampsiteStatus } from "../entities/campsite.entity";
import type { Campsite } from "../entities/campsite.entity";
import type { Zone } from "../entities/zone.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CampsitesRepository } from "../repositories/campsites.repository";

interface PromotedCampsiteMedia {
	media: CreateCampsiteDto["media"];
	filePaths: string[];
}

@Injectable()
export class CampsitesService {
	private readonly logger = new Logger(CampsitesService.name);

	constructor(
		private readonly campsitesRepository: CampsitesRepository,
		private readonly dataSource: DataSource
	) {}

	async updateMedia(
		hostId: string,
		campsiteId: string,
		dto: UpdateCampsiteMediaDto
	): Promise<CampsiteMedia[]> {
		const campsite = await this.campsitesRepository.findOne({ where: { id: campsiteId } });
		if (!campsite) {
			throw new NotFoundException("Campsite not found");
		}

		if (campsite.hostId !== hostId) {
			throw new ForbiddenException("Insufficient permission");
		}

		const promotedMedia = await this.promotePendingMedia(dto.media);

		try {
			const updated = await this.dataSource.transaction(async (manager: EntityManager) => {
				const mediaRepository = manager.getRepository(CampsiteMedia);
				const existingMedia = await mediaRepository.find({
					where: { campsiteId },
				});

				const newUrls = new Set(promotedMedia.media.map((m) => m.url));
				const toDelete = existingMedia.filter((em) => !newUrls.has(em.url));

				if (toDelete.length > 0) {
					await mediaRepository.remove(toDelete);
				}

				const mediaToSave = promotedMedia.media.map((item, index) => {
					const existing = existingMedia.find((em) => em.url === item.url);
					return mediaRepository.create({
						id: existing?.id,
						campsiteId,
						url: item.url,
						type: item.type ?? "photo",
						sortOrder: item.sortOrder ?? index,
					});
				});

				const saved = await mediaRepository.save(mediaToSave);
				saved.sort((a, b) => a.sortOrder - b.sortOrder);

				await manager.getRepository(AuditLog).save({
					actorId: hostId,
					action: "campsite.media_updated",
					targetType: "campsite",
					targetId: campsiteId,
					before: {
						media: existingMedia.map((em) => ({
							id: em.id,
							url: em.url,
							type: em.type,
							sortOrder: em.sortOrder,
						})),
					},
					after: {
						media: saved.map((sm) => ({
							id: sm.id,
							url: sm.url,
							type: sm.type,
							sortOrder: sm.sortOrder,
						})),
					},
					reason: "host_manage_campsite_images",
				});

				this.logger.warn(
					`Trip warning: Campsite ${campsiteId} media updated. Affected trips must be warned.`
				);

				return saved;
			});

			return updated;
		} catch (error) {
			await this.deletePromotedFiles(promotedMedia.filePaths);
			throw error;
		}
	}

	async create(hostId: string, dto: CreateCampsiteDto): Promise<CampsiteResponseDto> {
		const promotedMedia = await this.promotePendingMedia(dto.media);

		try {
			const { campsite, media, zones, latitude, longitude } = await this.dataSource.transaction(
				async (manager: EntityManager) => {
					const transactionalCampsitesRepository = manager.withRepository(this.campsitesRepository);
					const created = await transactionalCampsitesRepository.createPendingApproval({
						hostId,
						name: dto.name,
						description: dto.description,
						latitude: dto.latitude,
						longitude: dto.longitude,
						province: dto.province,
						policies: { ...dto.policies },
						operatingHours: { ...dto.operatingHours },
						seasonStartDate: dto.seasonStartDate,
						seasonEndDate: dto.seasonEndDate,
						maxAdvanceBookingDays: dto.maxAdvanceBookingDays,
						minNights: dto.minNights,
						maxNights: dto.maxNights,
						media: promotedMedia.media.map((item) => ({
							url: item.url,
							type: item.type ?? "photo",
							sortOrder: item.sortOrder,
						})),
						zones: dto.zones,
					});

					await manager.getRepository(AuditLog).save({
						actorId: hostId,
						action: "campsite.created",
						targetType: "campsite",
						targetId: created.campsite.id,
						before: null,
						after: this.snapshotCreatedCampsite(
							created.campsite,
							created.media,
							created.zones,
							created.latitude,
							created.longitude
						),
						reason: "host_create_campsite",
					});

					return created;
				}
			);

			return toCampsiteResponse(campsite, media, zones, latitude, longitude);
		} catch (error) {
			await this.deletePromotedFiles(promotedMedia.filePaths);
			throw error;
		}
	}

	async search(query: SearchCampsitesQueryDto): Promise<PaginatedCampsiteSearchResponseDto> {
		const { page, limit, province, amenities, minPrice, maxPrice } = query;

		const { items, total } = await this.campsitesRepository.searchActive(
			{ province, amenities, minPrice, maxPrice },
			page,
			limit
		);

		return {
			items: items.map(({ campsite, coverImageUrl, latitude, longitude }) =>
				toCampsiteSearchItem(campsite, coverImageUrl, latitude, longitude)
			),
			pagination: {
				page,
				limit,
				total,
				totalPages: total === 0 ? 0 : Math.ceil(total / limit),
			},
		};
	}

	async listMine(hostId: string): Promise<CampsiteResponseDto[]> {
		const rows = await this.campsitesRepository.findByHost(hostId);

		return rows.map(({ campsite, media, zones, latitude, longitude }) =>
			toCampsiteResponse(campsite, media, zones, latitude, longitude)
		);
	}

	async update(
		hostId: string,
		campsiteId: string,
		dto: UpdateCampsiteDto
	): Promise<CampsiteResponseDto> {
		this.ensureUpdateHasChanges(dto);
		let promotedMedia: PromotedCampsiteMedia | undefined;

		try {
			const { campsite, media, zones, latitude, longitude } = await this.dataSource.transaction(
				async (manager: EntityManager) => {
					const transactionalCampsitesRepository = manager.withRepository(this.campsitesRepository);
					const current = await transactionalCampsitesRepository.findDetailedById(campsiteId, true);

					if (!current) {
						throw new NotFoundException("Campsite not found");
					}
					if (current.campsite.hostId !== hostId) {
						throw new ForbiddenException("Only the owning Host can edit this campsite");
					}
					if (
						dto.expectedUpdatedAt &&
						!sameInstant(current.campsite.updatedAt, dto.expectedUpdatedAt)
					) {
						throw new ConflictException("Campsite information changed. Reload before retrying.");
					}

					promotedMedia =
						dto.media === undefined ? undefined : await this.promotePendingMedia(dto.media);

					const before = this.snapshotCampsite(
						current.campsite,
						current.media,
						current.zones,
						current.latitude,
						current.longitude
					);

					const input = {
						name: dto.name,
						description: dto.description,
						latitude: dto.latitude,
						longitude: dto.longitude,
						province: dto.province,
						policies: dto.policies ? { ...dto.policies } : undefined,
						operatingHours: dto.operatingHours ? { ...dto.operatingHours } : undefined,
						seasonStartDate: dto.seasonStartDate,
						seasonEndDate: dto.seasonEndDate,
						maxAdvanceBookingDays: dto.maxAdvanceBookingDays,
						minNights: dto.minNights,
						maxNights: dto.maxNights,
						media: promotedMedia?.media.map((item) => ({
							url: item.url,
							type: item.type ?? "photo",
							sortOrder: item.sortOrder,
						})),
						zones: dto.zones,
					};
					const updated = await transactionalCampsitesRepository.updateInformation(
						current.campsite,
						input
					);
					const after = this.snapshotCampsite(
						updated.campsite,
						updated.media,
						updated.zones,
						updated.latitude,
						updated.longitude
					);

					if (!deepEqual(before, after)) {
						await manager.getRepository(AuditLog).save({
							actorId: hostId,
							action: "campsite.updated",
							targetType: "campsite",
							targetId: updated.campsite.id,
							before,
							after,
							reason: dto.changeReason ?? "host_edit_campsite",
						});
					}

					return updated;
				}
			);

			return toCampsiteResponse(campsite, media, zones, latitude, longitude);
		} catch (error) {
			await this.deletePromotedFiles(promotedMedia?.filePaths ?? []);
			throw error;
		}
	}

	async reviewCampsite(
		adminId: string,
		campsiteId: string,
		dto: ReviewCampsiteDto
	): Promise<CampsiteResponseDto> {
		const { campsite, media, zones, latitude, longitude } = await this.dataSource.transaction(
			async (manager: EntityManager) => {
				const transactionalCampsitesRepository = manager.withRepository(this.campsitesRepository);
				const current = await transactionalCampsitesRepository.findDetailedById(campsiteId, true);

				if (!current) {
					throw new NotFoundException("Campsite not found");
				}

				if (current.campsite.status !== CampsiteStatus.PENDING_APPROVAL) {
					throw new ConflictException("Only campsites in pending_approval status can be reviewed");
				}

				const before = this.snapshotCampsite(
					current.campsite,
					current.media,
					current.zones,
					current.latitude,
					current.longitude
				);

				const newStatus =
					dto.action === ReviewCampsiteAction.APPROVE
						? CampsiteStatus.ACTIVE
						: CampsiteStatus.DRAFT;

				current.campsite.status = newStatus;
				await transactionalCampsitesRepository.updateStatus(current.campsite, newStatus);

				const after = this.snapshotCampsite(
					current.campsite,
					current.media,
					current.zones,
					current.latitude,
					current.longitude
				);

				const action =
					dto.action === ReviewCampsiteAction.APPROVE ? "campsite.approved" : "campsite.declined";

				await manager.getRepository(AuditLog).save({
					actorId: adminId,
					action,
					targetType: "campsite",
					targetId: campsiteId,
					before,
					after,
					reason: dto.reason ?? null,
				});

				return {
					campsite: current.campsite,
					media: current.media,
					zones: current.zones,
					latitude: current.latitude,
					longitude: current.longitude,
				};
			}
		);

		try {
			this.logger.log(
				`Notification emitted: Campsite ${campsiteId} has been reviewed. Action: ${dto.action}. Reason: ${dto.reason ?? "N/A"}`
			);
		} catch (notificationError) {
			this.logger.error(
				`Failed to emit notification for campsite review: ${
					notificationError instanceof Error ? notificationError.message : String(notificationError)
				}`
			);
		}

		return toCampsiteResponse(campsite, media, zones, latitude, longitude);
	}

	private snapshotCreatedCampsite(
		campsite: Campsite,
		media: CampsiteMedia[],
		zones: Zone[],
		latitude: number,
		longitude: number
	) {
		return this.snapshotCampsite(campsite, media, zones, latitude, longitude);
	}

	private snapshotCampsite(
		campsite: Campsite,
		media: CampsiteMedia[],
		zones: Zone[],
		latitude: number,
		longitude: number
	): Record<string, unknown> {
		return {
			id: campsite.id,
			hostId: campsite.hostId,
			name: campsite.name,
			description: campsite.description,
			latitude,
			longitude,
			province: campsite.province,
			policies: campsite.policies,
			operatingHours: campsite.operatingHours,
			seasonStartDate: campsite.seasonStartDate,
			seasonEndDate: campsite.seasonEndDate,
			maxAdvanceBookingDays: campsite.maxAdvanceBookingDays,
			minNights: campsite.minNights,
			maxNights: campsite.maxNights,
			status: campsite.status,
			media: media.map((item) => ({
				id: item.id,
				url: item.url,
				type: item.type,
				sortOrder: item.sortOrder,
			})),
			zones: zones.map((zone) => ({
				id: zone.id,
				name: zone.name,
				maxTents: zone.maxTents,
				maxPeople: zone.maxPeople,
				basePrice: zone.basePrice,
				amenities: zone.amenities,
				terrainNote: zone.terrainNote,
				status: zone.status,
			})),
		};
	}

	private ensureUpdateHasChanges(dto: UpdateCampsiteDto): void {
		if (
			(dto.latitude === undefined && dto.longitude !== undefined) ||
			(dto.latitude !== undefined && dto.longitude === undefined)
		) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				error: "Unprocessable Entity",
				message: [
					{
						field: "location",
						errors: ["latitude and longitude must be updated together"],
					},
				],
			});
		}

		const editableKeys: Array<keyof UpdateCampsiteDto> = [
			"name",
			"description",
			"latitude",
			"longitude",
			"province",
			"policies",
			"operatingHours",
			"seasonStartDate",
			"seasonEndDate",
			"maxAdvanceBookingDays",
			"minNights",
			"maxNights",
			"media",
			"zones",
		];
		if (editableKeys.some((key) => dto[key] !== undefined)) {
			return;
		}

		throw new UnprocessableEntityException({
			statusCode: 422,
			error: "Unprocessable Entity",
			message: [
				{
					field: "body",
					errors: ["At least one editable campsite field is required"],
				},
			],
		});
	}

	private async promotePendingMedia(
		media: CreateCampsiteDto["media"]
	): Promise<PromotedCampsiteMedia> {
		const promotedFilePaths: string[] = [];
		const promotedMedia = [];

		try {
			for (const item of media) {
				const promoted = await this.promotePendingMediaUrl(item.url);
				if (promoted.filePath) {
					promotedFilePaths.push(promoted.filePath);
				}

				promotedMedia.push({
					...item,
					url: promoted.url,
				});
			}
		} catch (error) {
			await this.deletePromotedFiles(promotedFilePaths);
			throw error;
		}

		return {
			media: promotedMedia,
			filePaths: promotedFilePaths,
		};
	}

	private async promotePendingMediaUrl(url: string): Promise<{ url: string; filePath?: string }> {
		const parsedUrl = new URL(url);

		if (!parsedUrl.pathname.startsWith(CAMPSITE_PENDING_UPLOAD_PUBLIC_PATH)) {
			return { url };
		}

		const fileName = basename(parsedUrl.pathname);
		const campsiteUploadDir = getCampsiteUploadDir();
		const sourcePath = join(getCampsitePendingUploadDir(), fileName);
		const targetPath = join(campsiteUploadDir, fileName);

		await mkdir(campsiteUploadDir, { recursive: true });
		try {
			await rename(sourcePath, targetPath);
		} catch (error) {
			if (isFileNotFoundError(error)) {
				throw new UnprocessableEntityException({
					statusCode: 422,
					error: "Unprocessable Entity",
					message: [
						{
							field: "media",
							errors: [
								"Ảnh tạm không còn tồn tại. Vui lòng chọn hoặc upload lại ảnh trước khi tạo campsite.",
							],
						},
					],
				});
			}

			throw error;
		}

		parsedUrl.pathname = `${CAMPSITE_UPLOAD_PUBLIC_PATH}${fileName}`;

		return {
			url: parsedUrl.toString(),
			filePath: targetPath,
		};
	}

	private async deletePromotedFiles(filePaths: string[]): Promise<void> {
		await Promise.all(
			filePaths.map((filePath) =>
				unlink(filePath).catch(() => {
					return undefined;
				})
			)
		);
	}
}

function isFileNotFoundError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "ENOENT"
	);
}

function sameInstant(left: Date, right: string): boolean {
	const rightDate = new Date(right);
	return Number.isFinite(rightDate.getTime()) && left.getTime() === rightDate.getTime();
}

function deepEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}
