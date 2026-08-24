import { ApiProperty } from "@nestjs/swagger";
import type { Campsite } from "../entities/campsite.entity";

export class CampsiteLocationDto {
	@ApiProperty()
	province!: string;

	@ApiProperty()
	latitude!: number;

	@ApiProperty()
	longitude!: number;
}

/**
 * BR-048: "name, location, representative image, and active routes" is the
 * exact field set a search result must carry -- nothing from the full
 * Campsite record beyond what's needed for a result card (no description,
 * policies, operating_hours -- that's CTMS-18's View Campsite Details job).
 */
export class CampsiteSearchItemDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty({ type: CampsiteLocationDto })
	location!: CampsiteLocationDto;

	@ApiProperty({
		type: String,
		nullable: true,
		description: "URL of the lowest-display_order image, or null if the campsite has none yet",
	})
	coverImage!: string | null;

	/**
	 * DG-6 (frozen): always `[]`. Trekking Routes is an entirely separate,
	 * unbuilt domain (not part of Epic 2 Campsite) -- this field exists to
	 * satisfy BR-048's contract shape without fabricating route data. See
	 * the spec's Backend section (Step 8) for the full reasoning.
	 */
	@ApiProperty({
		type: [String],
		description: "Always empty -- Trekking Routes is out of scope for CTMS-17-T01",
	})
	activeRoutes!: string[];
}

export class CampsiteSearchPaginationDto {
	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty()
	total!: number;

	@ApiProperty()
	totalPages!: number;
}

export class PaginatedCampsiteSearchResponseDto {
	@ApiProperty({ type: [CampsiteSearchItemDto] })
	items!: CampsiteSearchItemDto[];

	@ApiProperty({ type: CampsiteSearchPaginationDto })
	pagination!: CampsiteSearchPaginationDto;
}

/**
 * `coverImageUrl` and coordinates are passed in separately because they
 * come from `campsite_media` and PostGIS expressions, not simple entity
 * scalar columns.
 */
export function toCampsiteSearchItem(
	campsite: Campsite,
	coverImageUrl: string | null,
	latitude: number,
	longitude: number
): CampsiteSearchItemDto {
	return {
		id: campsite.id,
		name: campsite.name,
		location: {
			province: campsite.province,
			latitude,
			longitude,
		},
		coverImage: coverImageUrl,
		activeRoutes: [],
	};
}
