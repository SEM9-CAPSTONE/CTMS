import { Injectable } from "@nestjs/common";
import { In, Repository } from "typeorm";
import { CampsiteMedia } from "../entities/campsite-media.entity";
import { type Campsite, CampsiteStatus, type GeoPoint } from "../entities/campsite.entity";
import { Zone, ZoneStatus } from "../entities/zone.entity";

export interface CreateCampsiteMediaInput {
	url: string;
	type: string;
	sortOrder?: number;
}

export interface CreateCampsiteZoneInput {
	name: string;
	latitude: number;
	longitude: number;
	maxTents: number;
	maxPeople: number;
	basePrice: number;
	amenities?: string[];
	terrainNote?: string;
}

export interface CreatePendingApprovalCampsiteInput {
	hostId: string;
	name: string;
	description?: string;
	latitude: number;
	longitude: number;
	province: string;
	policies: Record<string, unknown>;
	operatingHours: Record<string, unknown>;
	seasonStartDate?: string;
	seasonEndDate?: string;
	maxAdvanceBookingDays?: number;
	minNights?: number;
	maxNights?: number;
	media: CreateCampsiteMediaInput[];
	zones?: CreateCampsiteZoneInput[];
}

export interface CampsiteSearchFilters {
	province?: string;
	amenities?: string[];
	minPrice?: number;
	maxPrice?: number;
}

export interface CampsiteSearchResultRow {
	campsite: Campsite;
	coverImageUrl: string | null;
	latitude: number;
	longitude: number;
}

export interface CampsiteSearchResult {
	items: CampsiteSearchResultRow[];
	total: number;
}

export interface HostCampsiteResultRow {
	campsite: Campsite;
	media: CampsiteMedia[];
	zones: Zone[];
	latitude: number;
	longitude: number;
}

export interface CreatedPendingApprovalCampsite {
	campsite: Campsite;
	media: CampsiteMedia[];
	zones: Zone[];
	latitude: number;
	longitude: number;
}

export interface UpdateCampsiteInformationInput {
	name?: string;
	description?: string;
	latitude?: number;
	longitude?: number;
	province?: string;
	policies?: Record<string, unknown>;
	operatingHours?: Record<string, unknown>;
	seasonStartDate?: string;
	seasonEndDate?: string;
	maxAdvanceBookingDays?: number;
	minNights?: number;
	maxNights?: number;
	media?: CreateCampsiteMediaInput[];
	zones?: CreateCampsiteZoneInput[];
}

@Injectable()
export class CampsitesRepository extends Repository<Campsite> {
	async createPendingApproval(
		input: CreatePendingApprovalCampsiteInput
	): Promise<CreatedPendingApprovalCampsite> {
		const campsite = this.create({
			hostId: input.hostId,
			name: input.name,
			description: input.description ?? null,
			location: toPoint(input.latitude, input.longitude),
			province: input.province,
			policies: input.policies,
			operatingHours: input.operatingHours,
			seasonStartDate: input.seasonStartDate ?? null,
			seasonEndDate: input.seasonEndDate ?? null,
			maxAdvanceBookingDays: input.maxAdvanceBookingDays ?? null,
			minNights: input.minNights ?? null,
			maxNights: input.maxNights ?? null,
			status: CampsiteStatus.PENDING_APPROVAL,
		});
		const savedCampsite = await this.save(campsite);

		const mediaRepository = this.manager.getRepository(CampsiteMedia);
		const media = await mediaRepository.save(
			input.media.map((item, index) =>
				mediaRepository.create({
					campsiteId: savedCampsite.id,
					url: item.url,
					type: item.type,
					sortOrder: item.sortOrder ?? index,
				})
			)
		);

		const zoneRepository = this.manager.getRepository(Zone);
		const zones = await zoneRepository.save(
			(input.zones ?? []).map((zone) =>
				zoneRepository.create({
					campsiteId: savedCampsite.id,
					name: zone.name,
					location: toPoint(zone.latitude, zone.longitude),
					maxTents: zone.maxTents,
					maxPeople: zone.maxPeople,
					basePrice: zone.basePrice.toFixed(2),
					amenities: zone.amenities ?? null,
					terrainNote: zone.terrainNote ?? null,
					status: ZoneStatus.ACTIVE,
				})
			)
		);

		return {
			campsite: savedCampsite,
			media,
			zones,
			latitude: input.latitude,
			longitude: input.longitude,
		};
	}

	async searchActive(
		filters: CampsiteSearchFilters,
		page: number,
		limit: number
	): Promise<CampsiteSearchResult> {
		const qb = this.createQueryBuilder("campsite")
			.addSelect("ST_Y(campsite.location::geometry)", "campsite_latitude")
			.addSelect("ST_X(campsite.location::geometry)", "campsite_longitude")
			.where("campsite.status = :activeStatus", {
				activeStatus: CampsiteStatus.ACTIVE,
			});

		if (filters.province) {
			qb.andWhere("campsite.province ILIKE :province", { province: filters.province });
		}

		const hasAmenities = Boolean(filters.amenities?.length);
		const hasMinPrice = filters.minPrice !== undefined;
		const hasMaxPrice = filters.maxPrice !== undefined;

		if (hasAmenities || hasMinPrice || hasMaxPrice) {
			const zoneSub = this.manager
				.createQueryBuilder(Zone, "zone")
				.select("1")
				.where("zone.campsiteId = campsite.id")
				.andWhere("zone.status = :zoneActiveStatus");

			if (hasAmenities) {
				zoneSub.andWhere("zone.amenities ?| ARRAY[:...amenities]");
			}
			if (hasMinPrice) {
				zoneSub.andWhere("zone.basePrice >= :minPrice");
			}
			if (hasMaxPrice) {
				zoneSub.andWhere("zone.basePrice <= :maxPrice");
			}

			qb.andWhere(`EXISTS (${zoneSub.getQuery()})`);
			qb.setParameters({
				zoneActiveStatus: ZoneStatus.ACTIVE,
				...(hasAmenities ? { amenities: filters.amenities } : {}),
				...(hasMinPrice ? { minPrice: filters.minPrice } : {}),
				...(hasMaxPrice ? { maxPrice: filters.maxPrice } : {}),
			});
		}

		qb.orderBy("campsite.createdAt", "DESC")
			.addOrderBy("campsite.id", "ASC")
			.skip((page - 1) * limit)
			.take(limit);

		const { entities: campsites, raw } = await qb.getRawAndEntities();
		const total = await qb.getCount();
		const coverImages = await this.resolveCoverImages(campsites.map((campsite) => campsite.id));
		const coordinates = new Map<string, { latitude: number; longitude: number }>();

		for (const row of raw as Array<Record<string, unknown>>) {
			const id = String(row.campsite_id);
			coordinates.set(id, {
				latitude: Number(row.campsite_latitude),
				longitude: Number(row.campsite_longitude),
			});
		}

		return {
			items: campsites.map((campsite) => {
				const coordinate = coordinates.get(campsite.id) ?? { latitude: 0, longitude: 0 };
				return {
					campsite,
					coverImageUrl: coverImages.get(campsite.id) ?? null,
					latitude: coordinate.latitude,
					longitude: coordinate.longitude,
				};
			}),
			total,
		};
	}

	async findByHost(hostId: string): Promise<HostCampsiteResultRow[]> {
		const qb = this.createQueryBuilder("campsite")
			.addSelect("ST_Y(campsite.location::geometry)", "campsite_latitude")
			.addSelect("ST_X(campsite.location::geometry)", "campsite_longitude")
			.where("campsite.hostId = :hostId", { hostId })
			.orderBy("campsite.createdAt", "DESC")
			.addOrderBy("campsite.id", "ASC");

		const { entities: campsites, raw } = await qb.getRawAndEntities();
		const campsiteIds = campsites.map((campsite) => campsite.id);
		const mediaByCampsiteId = await this.resolveMedia(campsiteIds);
		const zonesByCampsiteId = await this.resolveZones(campsiteIds);
		const coordinates = new Map<string, { latitude: number; longitude: number }>();

		for (const row of raw as Array<Record<string, unknown>>) {
			const id = String(row.campsite_id);
			coordinates.set(id, {
				latitude: Number(row.campsite_latitude),
				longitude: Number(row.campsite_longitude),
			});
		}

		return campsites.map((campsite) => {
			const coordinate = coordinates.get(campsite.id) ?? { latitude: 0, longitude: 0 };

			return {
				campsite,
				media: mediaByCampsiteId.get(campsite.id) ?? [],
				zones: zonesByCampsiteId.get(campsite.id) ?? [],
				latitude: coordinate.latitude,
				longitude: coordinate.longitude,
			};
		});
	}

	async findDetailedById(id: string, lockForUpdate = false): Promise<HostCampsiteResultRow | null> {
		const qb = this.createQueryBuilder("campsite")
			.addSelect("ST_Y(campsite.location::geometry)", "campsite_latitude")
			.addSelect("ST_X(campsite.location::geometry)", "campsite_longitude")
			.where("campsite.id = :id", { id });

		if (lockForUpdate) {
			qb.setLock("pessimistic_write");
		}

		const { entities: campsites, raw } = await qb.getRawAndEntities();
		const campsite = campsites[0];
		if (!campsite) {
			return null;
		}

		const mediaByCampsiteId = await this.resolveMedia([campsite.id]);
		const zonesByCampsiteId = await this.resolveZones([campsite.id]);
		const row = raw[0] as Record<string, unknown> | undefined;

		return {
			campsite,
			media: mediaByCampsiteId.get(campsite.id) ?? [],
			zones: zonesByCampsiteId.get(campsite.id) ?? [],
			latitude: Number(row?.campsite_latitude ?? 0),
			longitude: Number(row?.campsite_longitude ?? 0),
		};
	}

	async updateInformation(
		campsite: Campsite,
		input: UpdateCampsiteInformationInput
	): Promise<HostCampsiteResultRow> {
		if (input.name !== undefined) {
			campsite.name = input.name;
		}
		if (input.description !== undefined) {
			campsite.description = input.description;
		}
		if (input.latitude !== undefined && input.longitude !== undefined) {
			campsite.location = toPoint(input.latitude, input.longitude);
		}
		if (input.province !== undefined) {
			campsite.province = input.province;
		}
		if (input.policies !== undefined) {
			campsite.policies = input.policies;
		}
		if (input.operatingHours !== undefined) {
			campsite.operatingHours = input.operatingHours;
		}
		if (input.seasonStartDate !== undefined) {
			campsite.seasonStartDate = input.seasonStartDate;
		}
		if (input.seasonEndDate !== undefined) {
			campsite.seasonEndDate = input.seasonEndDate;
		}
		if (input.maxAdvanceBookingDays !== undefined) {
			campsite.maxAdvanceBookingDays = input.maxAdvanceBookingDays;
		}
		if (input.minNights !== undefined) {
			campsite.minNights = input.minNights;
		}
		if (input.maxNights !== undefined) {
			campsite.maxNights = input.maxNights;
		}

		await this.save(campsite);

		if (input.media !== undefined) {
			const mediaRepository = this.manager.getRepository(CampsiteMedia);
			await mediaRepository.delete({ campsiteId: campsite.id });
			await mediaRepository.save(
				input.media.map((item, index) =>
					mediaRepository.create({
						campsiteId: campsite.id,
						url: item.url,
						type: item.type,
						sortOrder: item.sortOrder ?? index,
					})
				)
			);
		}

		if (input.zones !== undefined) {
			const zoneRepository = this.manager.getRepository(Zone);
			await zoneRepository.delete({ campsiteId: campsite.id });
			await zoneRepository.save(
				input.zones.map((zone) =>
					zoneRepository.create({
						campsiteId: campsite.id,
						name: zone.name,
						location: toPoint(zone.latitude, zone.longitude),
						maxTents: zone.maxTents,
						maxPeople: zone.maxPeople,
						basePrice: zone.basePrice.toFixed(2),
						amenities: zone.amenities ?? null,
						terrainNote: zone.terrainNote ?? null,
						status: ZoneStatus.ACTIVE,
					})
				)
			);
		}

		const updated = await this.findDetailedById(campsite.id);
		if (!updated) {
			throw new Error("Updated campsite could not be reloaded");
		}

		return updated;
	}

	async updateStatus(campsite: Campsite, status: CampsiteStatus): Promise<Campsite> {
		campsite.status = status;
		return this.save(campsite);
	}

	private async resolveCoverImages(campsiteIds: string[]): Promise<Map<string, string>> {
		if (campsiteIds.length === 0) {
			return new Map();
		}
		const rows = await this.manager
			.createQueryBuilder(CampsiteMedia, "media")
			.distinctOn(["media.campsiteId"])
			.where("media.campsiteId IN (:...campsiteIds)", { campsiteIds })
			.orderBy("media.campsiteId")
			.addOrderBy("media.sortOrder", "ASC")
			.getMany();
		return new Map(rows.map((row) => [row.campsiteId, row.url]));
	}

	private async resolveMedia(campsiteIds: string[]): Promise<Map<string, CampsiteMedia[]>> {
		if (campsiteIds.length === 0) {
			return new Map();
		}

		const rows = await this.manager.getRepository(CampsiteMedia).find({
			where: { campsiteId: In(campsiteIds) },
			order: { sortOrder: "ASC" },
		});

		return groupByCampsiteId(rows);
	}

	private async resolveZones(campsiteIds: string[]): Promise<Map<string, Zone[]>> {
		if (campsiteIds.length === 0) {
			return new Map();
		}

		const rows = await this.manager.getRepository(Zone).find({
			where: { campsiteId: In(campsiteIds) },
			order: { createdAt: "ASC" },
		});

		return groupByCampsiteId(rows);
	}
}

function toPoint(latitude: number, longitude: number): GeoPoint {
	return {
		type: "Point",
		coordinates: [longitude, latitude],
	};
}

function groupByCampsiteId<T extends { campsiteId: string }>(rows: T[]): Map<string, T[]> {
	const groups = new Map<string, T[]>();

	for (const row of rows) {
		const group = groups.get(row.campsiteId) ?? [];
		group.push(row);
		groups.set(row.campsiteId, group);
	}

	return groups;
}
