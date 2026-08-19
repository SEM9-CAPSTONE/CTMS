import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { type CampsiteResponseDto, toCampsiteResponse } from "../dto/campsite-response.dto";
import {
	type PaginatedCampsiteSearchResponseDto,
	toCampsiteSearchItem,
} from "../dto/campsite-search-result.dto";
import type { CreateCampsiteDto } from "../dto/create-campsite.dto";
import type { SearchCampsitesQueryDto } from "../dto/search-campsites-query.dto";
import type { CampsiteImage } from "../entities/campsite-image.entity";
import type { Campsite } from "../entities/campsite.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CampsitesRepository } from "../repositories/campsites.repository";

@Injectable()
export class CampsitesService {
	constructor(
		private readonly campsitesRepository: CampsitesRepository,
		private readonly dataSource: DataSource
	) {}

	async create(hostId: string, dto: CreateCampsiteDto): Promise<CampsiteResponseDto> {
		const { campsite, images } = await this.dataSource.transaction(
			async (manager: EntityManager) => {
				const transactionalCampsitesRepository = manager.withRepository(this.campsitesRepository);
				const created = await transactionalCampsitesRepository.createDraft({
					hostId,
					name: dto.name,
					description: dto.description,
					latitude: dto.latitude.toFixed(6),
					longitude: dto.longitude.toFixed(6),
					province: dto.province,
					city: dto.city,
					policies: dto.policies,
					operatingHours: dto.operatingHours,
					initialImages: dto.initialImages.map((image) => ({
						url: image.url,
						type: image.type ?? "photo",
						displayOrder: image.displayOrder,
					})),
				});

				await manager.getRepository(AuditLog).save({
					actorId: hostId,
					action: "campsite.created",
					targetType: "campsite",
					targetId: created.campsite.id,
					before: null,
					after: this.snapshotCreatedCampsite(created.campsite, created.images),
					reason: "host_create_campsite",
				});

				return created;
			}
		);

		return toCampsiteResponse(campsite, images);
	}

	async search(query: SearchCampsitesQueryDto): Promise<PaginatedCampsiteSearchResponseDto> {
		const { page, limit, province, city, amenities, minPrice, maxPrice } = query;

		const { items, total } = await this.campsitesRepository.searchActive(
			{ province, city, amenities, minPrice, maxPrice },
			page,
			limit
		);

		return {
			items: items.map(({ campsite, coverImageUrl }) =>
				toCampsiteSearchItem(campsite, coverImageUrl)
			),
			pagination: {
				page,
				limit,
				total,
				totalPages: total === 0 ? 0 : Math.ceil(total / limit),
			},
		};
	}

	private snapshotCreatedCampsite(campsite: Campsite, images: CampsiteImage[]) {
		return {
			id: campsite.id,
			hostId: campsite.hostId,
			name: campsite.name,
			description: campsite.description,
			latitude: campsite.latitude,
			longitude: campsite.longitude,
			province: campsite.province,
			city: campsite.city,
			policies: campsite.policies,
			operatingHours: campsite.operatingHours,
			status: campsite.status,
			images: images.map((image) => ({
				id: image.id,
				url: image.url,
				type: image.type,
				displayOrder: image.displayOrder,
			})),
		};
	}
}
