import { lineStringSchema } from "../schema/create-trekking-route.schema";
import type { GeoJsonLineString, Position } from "../types";

export const MAX_ROUTE_IMPORT_BYTES = 5 * 1024 * 1024;

function canonicalLineString(value: unknown): GeoJsonLineString {
	const parsed = lineStringSchema.safeParse(value);
	if (!parsed.success) throw new Error("Hình học LineString không hợp lệ.");
	return parsed.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function parseGeoJsonRoute(text: string): GeoJsonLineString {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error("Tệp GeoJSON không phải JSON hợp lệ.");
	}
	if (!isRecord(value)) throw new Error("Tệp GeoJSON không hợp lệ.");
	if (value.type === "LineString") return canonicalLineString(value);
	if (value.type === "Feature") {
		if (!isRecord(value.geometry) || value.geometry.type !== "LineString") {
			throw new Error("GeoJSON Feature phải chứa đúng một LineString.");
		}
		return canonicalLineString(value.geometry);
	}
	if (value.type === "FeatureCollection") {
		if (!Array.isArray(value.features)) throw new Error("GeoJSON FeatureCollection không hợp lệ.");
		const lines = value.features.flatMap((feature) => {
			if (!isRecord(feature) || feature.type !== "Feature" || !isRecord(feature.geometry))
				return [];
			return feature.geometry.type === "LineString" ? [feature.geometry] : [];
		});
		if (lines.length !== 1)
			throw new Error("FeatureCollection phải chứa duy nhất một LineString rõ ràng.");
		return canonicalLineString(lines[0]);
	}
	throw new Error("Chỉ hỗ trợ GeoJSON LineString.");
}

function xmlElements(parent: Document | Element, localName: string): Element[] {
	return Array.from(parent.getElementsByTagNameNS("*", localName));
}

function pointsFromXml(parent: Element, localName: "trkpt" | "rtept"): Position[] {
	return xmlElements(parent, localName).map((point) => {
		const latitude = Number(point.getAttribute("lat"));
		const longitude = Number(point.getAttribute("lon"));
		return [longitude, latitude];
	});
}

export function parseGpxRoute(text: string): GeoJsonLineString {
	const document = new DOMParser().parseFromString(text, "application/xml");
	if (xmlElements(document, "parsererror").length > 0)
		throw new Error("Tệp GPX không phải XML hợp lệ.");
	const tracks = xmlElements(document, "trk");
	const routes = xmlElements(document, "rte");
	if (tracks.length + routes.length !== 1) {
		throw new Error("GPX phải chứa duy nhất một track hoặc một route.");
	}
	const coordinates =
		tracks.length === 1 ? pointsFromXml(tracks[0], "trkpt") : pointsFromXml(routes[0], "rtept");
	return canonicalLineString({ type: "LineString", coordinates });
}

export async function parseRouteImportFile(file: File): Promise<GeoJsonLineString> {
	if (file.size > MAX_ROUTE_IMPORT_BYTES) throw new Error("Tệp nhập không được vượt quá 5 MB.");
	const text = await file.text();
	return file.name.toLowerCase().endsWith(".gpx") ? parseGpxRoute(text) : parseGeoJsonRoute(text);
}

const EARTH_RADIUS_METERS = 6_371_008.8;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function approximateLengthMeters(coordinates: Position[]): number {
	return coordinates.slice(1).reduce((total, current, index) => {
		const previous = coordinates[index];
		const latitudeDelta = radians(current[1] - previous[1]);
		const longitudeDelta = radians(current[0] - previous[0]);
		const a =
			Math.sin(latitudeDelta / 2) ** 2 +
			Math.cos(radians(previous[1])) *
				Math.cos(radians(current[1])) *
				Math.sin(longitudeDelta / 2) ** 2;
		return total + 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}, 0);
}
