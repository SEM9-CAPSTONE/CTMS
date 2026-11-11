import { ApiProperty } from "@nestjs/swagger";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../trips/entities/trip.entity";
import { RecoveryReason, RecoveryStatus, type RouteRecoveryContext } from "./route-recovery.types";

export class RouteRecoveryResponseDto implements RouteRecoveryContext {
	@ApiProperty({ enum: RecoveryStatus })
	status!: RecoveryStatus;

	@ApiProperty({ enum: RecoveryReason, nullable: true })
	reason!: RecoveryReason | null;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ enum: TripStatus })
	tripStatus!: TripStatus;

	@ApiProperty({
		format: "date-time",
		description: "DB snapshot observation time, not an activation/access lease",
	})
	observedAt!: string;

	@ApiProperty({
		type: "object",
		required: ["packageId", "packageVersion"],
		properties: {
			packageId: { type: "string", format: "uuid" },
			packageVersion: { type: "integer", minimum: 1 },
		},
	})
	requested!: RouteRecoveryContext["requested"];

	@ApiProperty({
		type: "object",
		nullable: true,
		required: ["id", "version", "sha256", "generatedAt", "routeId", "routeFingerprint"],
		properties: {
			id: { type: "string", format: "uuid" },
			version: { type: "integer", minimum: 1 },
			sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
			generatedAt: { type: "string", format: "date-time" },
			routeId: { type: "string", format: "uuid" },
			routeFingerprint: { type: "string", pattern: "^[a-f0-9]{64}$" },
		},
	})
	package!: RouteRecoveryContext["package"];

	@ApiProperty({
		type: "object",
		required: ["routeId", "routeFingerprint", "latestPackageVersion"],
		properties: {
			routeId: { type: "string", format: "uuid", nullable: true },
			routeFingerprint: { type: "string", nullable: true, pattern: "^[a-f0-9]{64}$" },
			latestPackageVersion: { type: "integer", nullable: true, minimum: 1 },
		},
	})
	current!: RouteRecoveryContext["current"];

	@ApiProperty({
		type: "object",
		nullable: true,
		required: ["type", "coordinates"],
		description:
			"Only the exact verified package geometry for AVAILABLE or STALE; never replacement geometry",
		properties: {
			type: { type: "string", enum: ["LineString"] },
			coordinates: {
				type: "array",
				minItems: 2,
				items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
			},
		},
	})
	geometry!: GeoLineString | null;

	@ApiProperty({
		type: "object",
		required: [
			"coordinateSystem",
			"coordinateOrder",
			"distanceUnit",
			"bearingUnit",
			"bearingReference",
			"bearingRange",
		],
		properties: {
			coordinateSystem: { type: "string", enum: ["EPSG:4326"] },
			coordinateOrder: { type: "string", enum: ["longitude,latitude"] },
			distanceUnit: { type: "string", enum: ["metre"] },
			bearingUnit: { type: "string", enum: ["degree"] },
			bearingReference: { type: "string", enum: ["true-north-clockwise"] },
			bearingRange: { type: "string", enum: ["[0,360)"] },
		},
	})
	conventions!: RouteRecoveryContext["conventions"];
}
