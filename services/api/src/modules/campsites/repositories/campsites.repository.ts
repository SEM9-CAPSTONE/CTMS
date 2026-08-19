import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { CampsiteImage } from "../entities/campsite-image.entity";
import { type Campsite, CampsiteStatus } from "../entities/campsite.entity";
import { Zone, ZoneStatus } from "../entities/zone.entity";

export interface CreateCampsiteImageInput {
	url: string;
	type: string;
	displayOrder?: number;
}

export interface CreateDraftCampsiteInput {
	hostId: string;
	name: string;
	description: string;
	latitude: string;
	longitude: string;
	province: string;
	city: string;
	policies: string;
	operatingHours: string;
	initialImages: CreateCampsiteImageInput[];
}

export interface CampsiteSearchFilters {
	province?: string;
	city?: string;
	amenities?: string[];
	minPrice?: number;
	maxPrice?: number;
}

export interface CampsiteSearchResultRow {
	campsite: Campsite;
	coverImageUrl: string | null;
}

export interface CampsiteSearchResult {
	items: CampsiteSearchResultRow[];
	total: number;
}

export interface CreatedDraftCampsite {
	campsite: Campsite;
	images: CampsiteImage[];
}

/**
 * CTMS-17-T01 (CTMS-77). Search Campsites' read path. Every query this
 * repository runs is `status = active` by construction -- {@link searchActive}
 * takes no `status` parameter at all, so there is no code path through which
 * a caller could widen the result set to non-active campsites (BR-047/234).
 */
@Injectable()
export class CampsitesRepository extends Repository<Campsite> {
	async createDraft(input: CreateDraftCampsiteInput): Promise<CreatedDraftCampsite> {
		const campsite = this.create({
			hostId: input.hostId,
			name: input.name,
			description: input.description,
			latitude: input.latitude,
			longitude: input.longitude,
			province: input.province,
			city: input.city,
			policies: input.policies,
			operatingHours: input.operatingHours,
			status: CampsiteStatus.DRAFT,
		});
		const savedCampsite = await this.save(campsite);

		const imageRepository = this.manager.getRepository(CampsiteImage);
		const images = await imageRepository.save(
			input.initialImages.map((image, index) =>
				imageRepository.create({
					campsiteId: savedCampsite.id,
					url: image.url,
					type: image.type,
					displayOrder: image.displayOrder ?? index,
				})
			)
		);

		return { campsite: savedCampsite, images };
	}

	async searchActive(
		filters: CampsiteSearchFilters,
		page: number,
		limit: number
	): Promise<CampsiteSearchResult> {
		const qb = this.createQueryBuilder("campsite").where("campsite.status = :activeStatus", {
			activeStatus: CampsiteStatus.ACTIVE,
		});

		// Case-insensitive exact match -- BR-046 only requires "filtering by
		// province/city", not free-text/partial search; ILIKE with no
		// wildcards gives exact match tolerant of input casing.
		if (filters.province) {
			qb.andWhere("campsite.province ILIKE :province", { province: filters.province });
		}
		if (filters.city) {
			qb.andWhere("campsite.city ILIKE :city", { city: filters.city });
		}

		const hasAmenities = Boolean(filters.amenities?.length);
		const hasMinPrice = filters.minPrice !== undefined;
		const hasMaxPrice = filters.maxPrice !== undefined;

		if (hasAmenities || hasMinPrice || hasMaxPrice) {
			// EXISTS, not JOIN: a campsite must match through at least one
			// qualifying zone, but must appear at most once in the result no
			// matter how many of its zones qualify -- EXISTS can never
			// multiply outer rows the way a JOIN would, so no DISTINCT/
			// GROUP BY is needed to keep `total`/pagination campsite-accurate.
			//
			// DG-NEW (frozen during Step 3 review): only `active` zones are
			// considered. Not spelled out by name in BR-046 -- this was raised
			// as an open Decision Gate (not silently inferred) and explicitly
			// resolved in favor of Option A: a `closed` zone must not be able
			// to make an otherwise-unrelated campsite surface in search
			// results via its amenities/price, matching the same "public
			// list only reflects bookable state" posture as BR-047/234.
			const zoneSub = this.manager
				.createQueryBuilder(Zone, "zone")
				.select("1")
				.where("zone.campsiteId = campsite.id")
				.andWhere("zone.status = :zoneActiveStatus");

			if (hasAmenities) {
				// `&&` = array overlap: true as soon as ANY element is shared,
				// which is exactly the frozen "any zone has any of these
				// amenities" semantics -- not "has all of them".
				zoneSub.andWhere("zone.amenities && :amenities::text[]");
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

		// Deterministic order: createdAt alone can tie (same-millisecond
		// seed/test inserts), `id` as a tiebreaker keeps pagination stable.
		qb.orderBy("campsite.createdAt", "DESC")
			.addOrderBy("campsite.id", "ASC")
			.skip((page - 1) * limit)
			.take(limit);

		const [campsites, total] = await qb.getManyAndCount();
		const coverImages = await this.resolveCoverImages(campsites.map((campsite) => campsite.id));

		return {
			items: campsites.map((campsite) => ({
				campsite,
				coverImageUrl: coverImages.get(campsite.id) ?? null,
			})),
			total,
		};
	}

	/**
	 * One row per campsite id: the lowest `displayOrder` image, i.e. the
	 * "representative image" (BR-048). `DISTINCT ON` is the Postgres-native
	 * way to pick exactly one row per group without a window-function
	 * subquery, ordered by the same column used to define "first".
	 */
	private async resolveCoverImages(campsiteIds: string[]): Promise<Map<string, string>> {
		if (campsiteIds.length === 0) {
			return new Map();
		}
		const rows = await this.manager
			.createQueryBuilder(CampsiteImage, "image")
			.distinctOn(["image.campsiteId"])
			.where("image.campsiteId IN (:...campsiteIds)", { campsiteIds })
			.orderBy("image.campsiteId")
			.addOrderBy("image.displayOrder", "ASC")
			.getMany();
		return new Map(rows.map((row) => [row.campsiteId, row.url]));
	}
}
