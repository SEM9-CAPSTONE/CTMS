import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	ArrayMaxSize,
	Equals,
	IsArray,
	IsDefined,
	IsEnum,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	Matches,
	Max,
	MaxLength,
	Min,
	Validate,
	ValidateNested,
	type ValidationArguments,
	ValidatorConstraint,
	type ValidatorConstraintInterface,
} from "class-validator";
import {
	TrekkingRouteDifficulty,
	type TrekkingRouteDrawing,
	TrekkingRouteDrawingMode,
	type TrekkingRouteDrawingSegment,
} from "../entities/trekking-route.entity";
import {
	CanonicalLineStringCoordinatesConstraint,
	isCanonicalLineStringCoordinates,
} from "../validators/line-string.validator";

function trimmedString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export class GeoJsonLineStringDto {
	@ApiProperty({ enum: ["LineString"] })
	@IsString()
	@Equals("LineString")
	type!: "LineString";

	@ApiProperty({
		type: "array",
		minItems: 2,
		items: {
			type: "array",
			minItems: 2,
			maxItems: 2,
			items: { type: "number" },
		},
		example: [
			[108.441, 11.941],
			[108.449, 11.946],
		],
	})
	@IsArray()
	@Validate(CanonicalLineStringCoordinatesConstraint)
	coordinates!: Array<[number, number]>;
}

const MAX_DRAWING_WAYPOINTS = 10_000;
const DRAWING_FORMATS = [...Object.values(TrekkingRouteDrawingMode), "hybrid"];

export class TrekkingRouteDrawingSegmentDto implements TrekkingRouteDrawingSegment {
	@ApiProperty()
	@IsString()
	@Matches(/^[a-zA-Z0-9_-]{1,64}$/)
	id!: string;

	@ApiProperty({ enum: TrekkingRouteDrawingMode })
	@IsEnum(TrekkingRouteDrawingMode)
	mode!: TrekkingRouteDrawingMode;

	@ApiProperty({ minimum: 1, maximum: MAX_DRAWING_WAYPOINTS - 1 })
	@IsInt()
	@Min(1)
	@Max(MAX_DRAWING_WAYPOINTS - 1)
	endIndex!: number;
}

export class TrekkingRouteDrawingDto implements TrekkingRouteDrawing {
	@ApiProperty({ enum: DRAWING_FORMATS })
	@IsIn(DRAWING_FORMATS)
	mode!: TrekkingRouteDrawing["mode"];

	@ApiProperty({
		type: "array",
		minItems: 2,
		maxItems: MAX_DRAWING_WAYPOINTS,
		items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
	})
	@IsArray()
	@ArrayMaxSize(MAX_DRAWING_WAYPOINTS)
	@Validate(CanonicalLineStringCoordinatesConstraint)
	waypoints!: TrekkingRouteDrawing["waypoints"];

	@ApiPropertyOptional({ type: [TrekkingRouteDrawingSegmentDto] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(MAX_DRAWING_WAYPOINTS - 1)
	@ValidateNested({ each: true })
	@Type(() => TrekkingRouteDrawingSegmentDto)
	segments?: TrekkingRouteDrawingSegmentDto[];
}

@ValidatorConstraint({ name: "routeDrawingMatchesGeometry" })
class RouteDrawingMatchesGeometry implements ValidatorConstraintInterface {
	validate(drawing: unknown, { object }: ValidationArguments): boolean {
		if (!(drawing instanceof TrekkingRouteDrawingDto)) return false;
		if (drawing.mode !== "hybrid") return drawing.segments === undefined;
		const { segments, waypoints } = drawing;
		const { geometry } = object as CreateTrekkingRouteDto;
		const coordinates = geometry?.coordinates;
		if (
			!isCanonicalLineStringCoordinates(coordinates) ||
			!isCanonicalLineStringCoordinates(waypoints) ||
			coordinates.length > MAX_DRAWING_WAYPOINTS ||
			!Array.isArray(segments) ||
			segments.length !== waypoints.length - 1 ||
			segments.length >= MAX_DRAWING_WAYPOINTS
		)
			return false;

		const ids = new Set<string>();
		let startIndex = 0;
		const matches = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
		if (!matches(coordinates[0], waypoints[0])) return false;
		for (const [index, segment] of segments.entries()) {
			if (!segment || !Number.isInteger(segment.endIndex)) return false;
			const { endIndex, id } = segment;
			if (
				ids.has(id) ||
				endIndex <= startIndex ||
				endIndex >= coordinates.length ||
				!matches(coordinates[endIndex], waypoints[index + 1]) ||
				!coordinates
					.slice(startIndex + 1, endIndex + 1)
					.some((point) => !matches(point, coordinates[startIndex]))
			)
				return false;
			ids.add(id);
			startIndex = endIndex;
		}
		return startIndex === coordinates.length - 1;
	}

	defaultMessage(): string {
		return "Các điểm và đoạn tuyến phải khớp với đường đã vẽ.";
	}
}

export class CreateTrekkingRouteDto {
	@ApiProperty({ maxLength: 150 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	name!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	description?: string;

	@ApiProperty({ type: GeoJsonLineStringDto })
	@IsDefined()
	@ValidateNested()
	@Type(() => GeoJsonLineStringDto)
	geometry!: GeoJsonLineStringDto;

	@ApiPropertyOptional({ type: TrekkingRouteDrawingDto })
	@IsOptional()
	@IsObject()
	@ValidateNested()
	@Validate(RouteDrawingMatchesGeometry)
	@Type(() => TrekkingRouteDrawingDto)
	drawing?: TrekkingRouteDrawingDto;

	@ApiProperty({ enum: TrekkingRouteDifficulty })
	@IsEnum(TrekkingRouteDifficulty)
	difficulty!: TrekkingRouteDifficulty;

	@ApiProperty({ minimum: 1, example: 120 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	expectedDurationMinutes!: number;
}
