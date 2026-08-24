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
import type { CampsiteMedia } from "../entities/campsite-media.entity";
import type { Campsite } from "../entities/campsite.entity";
import type { Zone } from "../entities/zone.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CampsitesRepository } from "../repositories/campsites.repository";

@Injectable()
export class CampsitesService {
	constructor(
		private readonly campsitesRepository: CampsitesRepository,
		private readonly dataSource: DataSource
	) {}

	async create(hostId: string, dto: CreateCampsiteDto): Promise<CampsiteResponseDto> {
		const { campsite, media, zones, latitude, longitude } = await this.dataSource.transaction(
			async (manager: EntityManager) => {
				const transactionalCampsitesRepository = manager.withRepository(this.campsitesRepository);
				const created = await transactionalCampsitesRepository.createDraft({
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
					media: dto.media.map((item) => ({
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

	private snapshotCreatedCampsite(
		campsite: Campsite,
		media: CampsiteMedia[],
		zones: Zone[],
		latitude: number,
		longitude: number
	) {
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
}
