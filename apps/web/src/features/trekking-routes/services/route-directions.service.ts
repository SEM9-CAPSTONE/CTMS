import { z } from "zod";
import { TERRAIN_MAX_VERTICES } from "../../route-safety/terrain-constants";
import { positionSchema } from "../schema/create-trekking-route.schema";
import type { GeoJsonLineString, Position } from "../types";
import { approximateLengthMeters } from "../utils/route-import";

const DIRECTIONS_URL = "https://api.maptiler.com/routing/v1/directions";
const REQUEST_TIMEOUT_MS = 12_000;
export const DEFAULT_SNAP_LIMIT_METERS = 75;
const MAX_LEG_GAP_METERS = 1;
// MapTiler's Routing client specifies six decimal places for encoded leg geometry.
const POLYLINE_SCALE = 1_000_000;
const directionsSchema = z.object({
	route: z.object({
		legs: z.array(z.object({ geometry: z.union([z.string(), z.array(positionSchema)]) })),
	}),
});
const errorSchema = z.object({ code: z.string() });

const messages = {
	invalid: "Dịch vụ trả về tuyến đường không hợp lệ. Vui lòng thử lại.",
	noRoute: "Không tìm thấy đường đi bộ qua các điểm đã chọn. Hãy điều chỉnh vị trí các điểm.",
	key: "Dịch vụ định tuyến chưa được cấp quyền truy cập.",
	request: "Không thể tìm đường với các điểm đã chọn. Hãy kiểm tra lại vị trí các điểm.",
	busy: "Dịch vụ định tuyến đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau.",
	unavailable: "Dịch vụ định tuyến đang gián đoạn. Vui lòng thử lại.",
	network: "Không thể kết nối dịch vụ định tuyến. Hãy kiểm tra kết nối rồi thử lại.",
	timeout: "Tìm đường quá thời gian chờ. Vui lòng thử lại.",
	limit: "Tuyến đường vượt quá giới hạn 10.000 tọa độ. Hãy chia thành các tuyến ngắn hơn.",
};

export class RouteDirectionsError extends Error {}

function snapDistanceMessage(waypointIndices: readonly number[], limitMeters: number) {
	const points = waypointIndices.map((index) => index + 1).join(" và ");
	return `Điểm vẽ ${points} cách tuyến đi bộ MapTiler tìm được hơn ${limitMeters} m. Hãy điều chỉnh vị trí.`;
}

export class RouteSnapDistanceError extends RouteDirectionsError {
	constructor(
		readonly waypointIndices: readonly number[],
		readonly limitMeters: number
	) {
		super(snapDistanceMessage(waypointIndices, limitMeters));
	}

	messageForRoute(legStartIndex: number) {
		return snapDistanceMessage(
			this.waypointIndices.map((index) => legStartIndex + index),
			this.limitMeters
		);
	}
}

export function decodeRoutePolyline(encoded: string): Position[] {
	const coordinates: Position[] = [];
	let cursor = 0;
	let latitude = 0;
	let longitude = 0;
	const readDelta = () => {
		let value = 0;
		for (let shift = 0; shift <= 30 && cursor < encoded.length; shift += 5) {
			const group = encoded.charCodeAt(cursor++) - 63;
			if (group < 0 || group > 63) break;
			value += (group & 31) * 2 ** shift;
			if (group < 32) return value % 2 ? -(value + 1) / 2 : value / 2;
		}
		throw new RouteDirectionsError(messages.invalid);
	};

	while (cursor < encoded.length) {
		latitude += readDelta();
		longitude += readDelta();
		const point = positionSchema.safeParse([longitude / POLYLINE_SCALE, latitude / POLYLINE_SCALE]);
		if (!point.success) throw new RouteDirectionsError(messages.invalid);
		coordinates.push(point.data);
	}
	return coordinates;
}

function normalizeDirections(
	payload: unknown,
	waypoints: Position[],
	snapLimitMeters: number
): GeoJsonLineString {
	const response = directionsSchema.safeParse(payload);
	if (!response.success) throw new RouteDirectionsError(messages.invalid);
	const { legs } = response.data.route;
	if (!legs.length) throw new RouteDirectionsError(messages.noRoute);
	if (legs.length !== waypoints.length - 1) throw new RouteDirectionsError(messages.invalid);

	const coordinates: Position[] = [];
	for (const [index, leg] of legs.entries()) {
		const points =
			typeof leg.geometry === "string" ? decodeRoutePolyline(leg.geometry) : leg.geometry;
		const first = points[0];
		const last = points.at(-1);
		if (points.length < 2 || !last) throw new RouteDirectionsError(messages.invalid);
		const remoteWaypoints = [index, index + 1].filter(
			(waypoint, endpoint) =>
				approximateLengthMeters([waypoints[waypoint], endpoint === 0 ? first : last]) >
				snapLimitMeters
		);
		if (remoteWaypoints.length) {
			throw new RouteSnapDistanceError(remoteWaypoints, snapLimitMeters);
		}
		const previous = coordinates.at(-1);
		if (previous && approximateLengthMeters([previous, first]) > MAX_LEG_GAP_METERS) {
			throw new RouteDirectionsError(messages.invalid);
		}
		for (const point of points) {
			const tail = coordinates.at(-1);
			if (!tail || tail[0] !== point[0] || tail[1] !== point[1]) coordinates.push(point);
			if (coordinates.length > TERRAIN_MAX_VERTICES) throw new RouteDirectionsError(messages.limit);
		}
	}
	if (coordinates.length < 2) throw new RouteDirectionsError(messages.noRoute);
	return { type: "LineString", coordinates };
}

async function responseError(response: Response): Promise<RouteDirectionsError> {
	switch (response.status) {
		case 401:
		case 403:
			return new RouteDirectionsError(messages.key);
		case 429:
			return new RouteDirectionsError(messages.busy);
		case 400: {
			const details = errorSchema.safeParse(await response.json().catch(() => null));
			if (details.success) {
				switch (details.data.code) {
					case "MT_NO_SUITABLE_EDGES":
					case "MT_LOCATION_UNREACHABLE":
					case "MT_PATH_NOT_FOUND":
					case "MT_UNCONNECTED_REGIONS":
						return new RouteDirectionsError(messages.noRoute);
					case "MT_KEY_INVALID":
						return new RouteDirectionsError(messages.key);
				}
			}
			return new RouteDirectionsError(messages.request);
		}
		case 404:
		case 422:
			return new RouteDirectionsError(messages.noRoute);
		default:
			return new RouteDirectionsError(messages.unavailable);
	}
}

export async function fetchRouteDirections(
	waypoints: Position[],
	signal: AbortSignal,
	snapLimitMeters = DEFAULT_SNAP_LIMIT_METERS
): Promise<GeoJsonLineString> {
	const key = import.meta.env.VITE_MAPTILER_API_KEY;
	if (!key) throw new RouteDirectionsError(messages.key);
	if (
		waypoints.length < 2 ||
		!waypoints.every((point) => positionSchema.safeParse(point).success)
	) {
		throw new RouteDirectionsError(messages.request);
	}
	const url = new URL(DIRECTIONS_URL);
	url.searchParams.set("key", key);
	const controller = new AbortController();
	const abort = () => controller.abort();
	if (signal.aborted) abort();
	signal.addEventListener("abort", abort, { once: true });
	let timedOut = false;
	const timeout = window.setTimeout(() => {
		timedOut = true;
		abort();
	}, REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				profile: "pedestrian",
				locations: waypoints.map(([lon, lat]) => ({ lon, lat, waypoint: true })),
			}),
			signal: controller.signal,
		});
		if (!response.ok) throw await responseError(response);
		const payload: unknown = await response.json();
		return normalizeDirections(payload, waypoints, snapLimitMeters);
	} catch (error) {
		if (signal.aborted) throw error;
		if (timedOut) throw new RouteDirectionsError(messages.timeout);
		if (error instanceof RouteDirectionsError) throw error;
		throw new RouteDirectionsError(
			error instanceof SyntaxError ? messages.invalid : messages.network
		);
	} finally {
		window.clearTimeout(timeout);
		signal.removeEventListener("abort", abort);
	}
}
