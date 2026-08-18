import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { CampsiteStatus } from "../entities/campsite.entity";

function optionalTrimmedString(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

/**
 * Accepts either a repeated query param (`?amenities=wifi&amenities=toilet`,
 * which Express/qs already arrays for us) or a single comma-separated value
 * (`?amenities=wifi,toilet`) -- both are common client shapes for a
 * multi-value filter, and normalizing here keeps the DTO/controller
 * agnostic to which one a given client used.
 */
function toStringArray(value: unknown): unknown {
	if (value === undefined || value === null) return value;
	const raw = Array.isArray(value) ? value : [value];
	return raw
		.flatMap((entry) => (typeof entry === "string" ? entry.split(",") : [entry]))
		.map((entry) => (typeof entry === "string" ? entry.trim() : entry))
		.filter((entry) => entry !== "");
}

export class SearchCampsitesQueryDto {
	@ApiPropertyOptional({ description: "Filter by province", maxLength: 100 })
	@IsOptional()
	@Transform(({ value }) => optionalTrimmedString(value))
	@IsString()
	@MaxLength(100)
	province?: string;

	@ApiPropertyOptional({ description: "Filter by city", maxLength: 100 })
	@IsOptional()
	@Transform(({ value }) => optionalTrimmedString(value))
	@IsString()
	@MaxLength(100)
	city?: string;

	/**
	 * DG-4 (frozen): a campsite matches if ANY of its zones has ANY of the
	 * requested amenities -- not "must have every requested amenity" on a
	 * single zone. Enforced by the repository's use of Postgres's `&&`
	 * (array overlap) operator against `zones.amenities`, see Step 3.
	 */
	@ApiPropertyOptional({
		description: "Filter by amenities -- a campsite matches if any zone has any of these",
		type: [String],
	})
	@IsOptional()
	@Transform(({ value }) => toStringArray(value))
	@IsString({ each: true })
	@MaxLength(50, { each: true })
	amenities?: string[];

	@ApiPropertyOptional({ description: "Minimum zone base price (inclusive)", minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	minPrice?: number;

	@ApiPropertyOptional({ description: "Maximum zone base price (inclusive)", minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	maxPrice?: number;

	/**
	 * DG-4/BR-047 (frozen): search only ever returns `active` campsites, by
	 * construction in the repository (Step 3) -- not merely by convention
	 * here. This param exists only so the API literally accepts a `status`
	 * filter per BR-046's wording; any value other than `active` is a 422,
	 * never silently ignored or passed through to a query that could widen
	 * the result set. There being only one legal value is intentional, not
	 * an oversight -- see the spec's Backend section (Step 8) for the full
	 * reasoning this reconciles BR-046 against BR-047/BR-234.
	 */
	@ApiPropertyOptional({ enum: [CampsiteStatus.ACTIVE], default: CampsiteStatus.ACTIVE })
	@IsOptional()
	@IsIn([CampsiteStatus.ACTIVE])
	status?: CampsiteStatus.ACTIVE;

	@ApiPropertyOptional({ default: 1, minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;
}
