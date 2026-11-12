import { unzipSync } from "fflate";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import { isCanonicalLineStringCoordinates } from "../trekking-routes/validators/line-string.validator";
import { PackageFailure, type PackageMetadata, PackageReason } from "./offline-packages.types";
import { canonical, digest } from "./package-policy";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Parse only after the existing bounded archive verifier has authenticated every payload. */
export function readVerifiedPackageRoute(bytes: Buffer, metadata: PackageMetadata): GeoLineString {
	try {
		const files = unzipSync(bytes, { filter: (entry) => entry.name === "route.geojson" });
		const feature: unknown = JSON.parse(Buffer.from(files["route.geojson"]).toString("utf8"));
		if (!isRecord(feature) || feature.type !== "Feature" || !isRecord(feature.properties))
			throw new Error();
		const geometry = feature.geometry;
		if (
			!isRecord(geometry) ||
			geometry.type !== "LineString" ||
			!isCanonicalLineStringCoordinates(geometry.coordinates)
		)
			throw new Error();
		const manifest = metadata.manifest;
		if (
			manifest.schemaVersion !== metadata.schema_version ||
			typeof manifest.route.routeId !== "string" ||
			!manifest.route.routeId ||
			!/^[a-f0-9]{64}$/.test(manifest.route.fingerprint) ||
			!Number.isFinite(new Date(metadata.generated_at).getTime()) ||
			manifest.tripId !== metadata.trip_id ||
			manifest.packageVersion !== metadata.package_version ||
			feature.properties.routeId !== manifest.route.routeId ||
			feature.properties.fingerprint !== manifest.route.fingerprint ||
			digest(canonical(geometry)) !== manifest.route.fingerprint
		)
			throw new Error();
		return {
			type: "LineString",
			coordinates: geometry.coordinates,
		};
	} catch {
		throw new PackageFailure([PackageReason.ARTIFACT_INVALID]);
	}
}
