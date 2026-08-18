import { Injectable } from "@nestjs/common";
import {
	type PaginatedCampsiteSearchResponseDto,
	toCampsiteSearchItem,
} from "../dto/campsite-search-result.dto";
import type { SearchCampsitesQueryDto } from "../dto/search-campsites-query.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CampsitesRepository } from "../repositories/campsites.repository";

/**
 * CTMS-17-T01 (CTMS-77). Read-only search -- no transaction/rollback/
 * idempotency concerns apply (N/A, not omitted): a search request neither
 * writes data nor has side effects to roll back or de-duplicate (BR-210/230
 * are about concurrent/retried *writes*).
 */
@Injectable()
export class CampsitesService {
	constructor(private readonly campsitesRepository: CampsitesRepository) {}

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
}
