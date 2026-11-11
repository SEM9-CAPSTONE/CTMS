import type { ValidationArguments, ValidatorConstraintInterface } from "class-validator";
import { ValidatorConstraint } from "class-validator";
import type {
	DangerZonePolygon,
	RouteDangerZoneGeometry,
} from "../entities/route-danger-zone.entity";
import { isCanonicalPointCoordinates } from "./point.validator";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyGeometryFields(value: Record<string, unknown>): boolean {
	const keys = Object.keys(value);
	return keys.length === 2 && keys.includes("type") && keys.includes("coordinates");
}

function positionsEqual(first: [number, number], last: [number, number]): boolean {
	return first[0] === last[0] && first[1] === last[1];
}

export function isCanonicalPolygonCoordinates(
	value: unknown
): value is DangerZonePolygon["coordinates"] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every(
			(ring) =>
				Array.isArray(ring) &&
				ring.length >= 4 &&
				ring.every(isCanonicalPointCoordinates) &&
				positionsEqual(ring[0], ring[ring.length - 1])
		)
	);
}

export function isCanonicalDangerZoneGeometry(value: unknown): value is RouteDangerZoneGeometry {
	if (!isRecord(value) || !hasOnlyGeometryFields(value)) return false;
	if (value.type === "Point") return isCanonicalPointCoordinates(value.coordinates);
	if (value.type === "Polygon") return isCanonicalPolygonCoordinates(value.coordinates);
	return false;
}

@ValidatorConstraint({ name: "routeDangerZoneGeometry" })
export class RouteDangerZoneGeometryConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return isCanonicalDangerZoneGeometry(value);
	}

	defaultMessage(_args: ValidationArguments): string {
		return "geometry must be a canonical GeoJSON Point or Polygon with finite, bounded [longitude, latitude] positions and closed Polygon rings";
	}
}

@ValidatorConstraint({ name: "routeDangerZoneRadius" })
export class RouteDangerZoneRadiusConstraint implements ValidatorConstraintInterface {
	validate(value: unknown, args: ValidationArguments): boolean {
		const object = args.object as { geometry?: unknown };
		if (!isRecord(object.geometry)) return true;
		if (object.geometry.type === "Point") {
			return typeof value === "number" && Number.isFinite(value) && value > 0;
		}
		if (object.geometry.type === "Polygon") return value === undefined;
		return true;
	}

	defaultMessage(_args: ValidationArguments): string {
		return "radiusMeters must be a finite positive number for Point geometry and must be absent for Polygon geometry";
	}
}
