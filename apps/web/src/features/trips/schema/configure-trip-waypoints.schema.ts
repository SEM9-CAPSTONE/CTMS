import { z } from "zod";
import type {
	ConfigureTripWaypointsInput,
	CreateTripWaypointInput,
	Trip,
	TripWaypointType,
} from "../types";
import { TRIP_WAYPOINT_TYPES } from "../types";

const coordinateMessage = "Tọa độ phải nằm trong phạm vi hợp lệ";

const coordinateString = z
	.string()
	.trim()
	.regex(/^-?\d+(\.\d+)?$/, coordinateMessage);

const waypointTypeFallbackNames: Record<TripWaypointType, string> = {
	start: "Bắt đầu",
	checkpoint: "Điểm kiểm tra",
	rest: "Nghỉ chân",
	meal: "Ăn uống",
	activity: "Hoạt động",
	overnight: "Chỗ ngủ",
	finish: "Kết thúc",
};

export interface ConfigureTripWaypointFormItem {
	/** Database id; empty while the waypoint has not been saved yet. */
	id: string;
	checkpointId: string;
	type: TripWaypointType;
	name: string;
	longitude: string;
	latitude: string;
	routeOrder: string;
	plannedAt: string;
}

export interface ConfigureTripWaypointsFormValues {
	waypoints: ConfigureTripWaypointFormItem[];
}

export function normalizeEndpointWaypoints(
	waypoints: ConfigureTripWaypointFormItem[]
): ConfigureTripWaypointFormItem[] {
	const startWaypoints = waypoints.filter((waypoint) => waypoint.type === "start");
	const finishWaypoints = waypoints.filter((waypoint) => waypoint.type === "finish");
	const firstStart = startWaypoints[0];
	const lastFinish = finishWaypoints.at(-1);
	const middleWaypoints = waypoints.filter(
		(waypoint) => waypoint.type !== "start" && waypoint.type !== "finish"
	);
	return [firstStart, ...middleWaypoints, lastFinish].filter(
		(waypoint): waypoint is ConfigureTripWaypointFormItem => Boolean(waypoint)
	);
}

export function createConfigureTripWaypointsSchema(trip: Trip) {
	return z
		.object({
			waypoints: z
				.array(
					z.object({
						id: z.string(),
						checkpointId: z.string(),
						type: z.enum(TRIP_WAYPOINT_TYPES),
						name: z.string().trim().max(150),
						longitude: coordinateString.refine(
							(value) => Math.abs(Number(value)) <= 180,
							"Kinh độ phải từ -180 đến 180"
						),
						latitude: coordinateString.refine(
							(value) => Math.abs(Number(value)) <= 90,
							"Vĩ độ phải từ -90 đến 90"
						),
						routeOrder: z
							.string()
							.regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?|0?\.\d+)$/, "Thứ tự trên tuyến chưa hợp lệ"),
						plannedAt: z.string().min(1, "Thời gian điểm dừng là bắt buộc"),
					})
				)
				.min(2, "Trip cần ít nhất điểm bắt đầu và điểm kết thúc"),
		})
		.superRefine((values, context) => {
			const startsAt = new Date(trip.startsAt);
			const endsAt = new Date(trip.endsAt);
			const startWaypoints = values.waypoints.filter((waypoint) => waypoint.type === "start");
			const finishWaypoints = values.waypoints.filter((waypoint) => waypoint.type === "finish");
			const overnightWaypoints = values.waypoints.filter(
				(waypoint) => waypoint.type === "overnight"
			);

			if (startWaypoints.length !== 1) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints"],
					message: "Chuyến đi phải có đúng một điểm bắt đầu",
				});
			}
			if (finishWaypoints.length !== 1) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints"],
					message: "Chuyến đi phải có đúng một điểm kết thúc",
				});
			}
			if (trip.tripType === "day_trip" && overnightWaypoints.length > 0) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints"],
					message: "Chuyến đi trong ngày không được có điểm dừng qua đêm",
				});
			}
			if (trip.tripType === "overnight" && overnightWaypoints.length !== trip.durationNights) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints"],
					message: `Chuyến đi qua đêm cần đúng ${trip.durationNights} điểm ngủ qua đêm`,
				});
			}

			const plannedTimes = new Set<string>();
			values.waypoints.forEach((waypoint, index) => {
				if (plannedTimes.has(waypoint.plannedAt)) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["waypoints", index, "plannedAt"],
						message: "Thời gian điểm dừng không được trùng trong cùng trip",
					});
				}
				plannedTimes.add(waypoint.plannedAt);
				const plannedAt = new Date(waypoint.plannedAt);
				if (plannedAt < startsAt || plannedAt > endsAt) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["waypoints", index, "plannedAt"],
						message: "Thời gian điểm dừng phải nằm trong lịch trình trip",
					});
				}
			});

			const sortedWaypoints = [...values.waypoints].sort(
				(first, second) => Number(first.routeOrder) - Number(second.routeOrder)
			);
			if (sortedWaypoints[0]?.type !== "start") {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints"],
					message: "Điểm đầu tiên phải là điểm bắt đầu",
				});
			}
			if (sortedWaypoints.at(-1)?.type !== "finish") {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints"],
					message: "Điểm cuối cùng phải là điểm kết thúc",
				});
			}
			sortedWaypoints.forEach((waypoint, index) => {
				const previousWaypoint = sortedWaypoints[index - 1];
				if (!previousWaypoint) return;
				const previousTime = new Date(previousWaypoint.plannedAt).getTime();
				const currentTime = new Date(waypoint.plannedAt).getTime();
				if (
					Number.isFinite(previousTime) &&
					Number.isFinite(currentTime) &&
					currentTime <= previousTime
				) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["waypoints", values.waypoints.indexOf(waypoint), "plannedAt"],
						message: `Thời gian phải sau điểm đứng trước trên tuyến (${previousWaypoint.name || previousWaypoint.type})`,
					});
				}
			});
		});
}

function toDateTimeLocalValue(value: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return localDate.toISOString().slice(0, 16);
}

/** Position along the route (0 = start, 1 = finish) saved with the waypoint, if any. */
function storedRouteOrder(waypoint: Trip["waypoints"][number], count: number): string {
	const saved = waypoint.metadata?.routeOrder;
	if (typeof saved === "string" && saved.trim()) return saved;
	if (typeof saved === "number" && Number.isFinite(saved)) return String(saved);
	if (waypoint.type === "start") return "0";
	if (waypoint.type === "finish") return "1";
	return String(Math.min(0.99, (waypoint.sequenceOrder - 1) / Math.max(1, count - 1)));
}

export function toConfigureTripWaypointFormItem(
	waypoint: Trip["waypoints"][number],
	count: number
): ConfigureTripWaypointFormItem {
	return {
		id: waypoint.id,
		checkpointId: waypoint.checkpointId ?? "",
		type: waypoint.type,
		name: waypoint.name,
		longitude: String(waypoint.location.coordinates[0]),
		latitude: String(waypoint.location.coordinates[1]),
		routeOrder: storedRouteOrder(waypoint, count),
		plannedAt: toDateTimeLocalValue(waypoint.plannedAt),
	};
}

export function toConfigureTripWaypointsDefaultValues(
	trip: Trip
): ConfigureTripWaypointsFormValues {
	return {
		waypoints: normalizeEndpointWaypoints(
			trip.waypoints.map((waypoint) =>
				toConfigureTripWaypointFormItem(waypoint, trip.waypoints.length)
			)
		),
	};
}

/** Checks the fields of one waypoint before it is saved on its own. */
export function validateWaypointForSave(
	waypoints: ConfigureTripWaypointFormItem[],
	index: number,
	trip: Pick<Trip, "startsAt" | "endsAt">
): string | null {
	const waypoint = waypoints[index];
	if (!waypoint) return "Không tìm thấy điểm dừng.";
	if (!waypoint.longitude?.trim() || !waypoint.latitude?.trim())
		return "Hãy chọn vị trí điểm dừng trên tuyến.";
	if ((waypoint.name ?? "").trim().length > 150) return "Mô tả tối đa 150 ký tự.";
	if (!waypoint.plannedAt) return "Thời gian điểm dừng là bắt buộc.";
	const plannedAt = new Date(waypoint.plannedAt).getTime();
	if (!Number.isFinite(plannedAt)) return "Thời gian điểm dừng chưa hợp lệ.";
	if (plannedAt < new Date(trip.startsAt).getTime() || plannedAt > new Date(trip.endsAt).getTime())
		return "Thời gian điểm dừng phải nằm trong lịch trình trip.";
	const duplicate = waypoints.some(
		(other, otherIndex) =>
			otherIndex !== index && other.plannedAt && new Date(other.plannedAt).getTime() === plannedAt
	);
	return duplicate ? "Thời gian điểm dừng không được trùng trong cùng trip." : null;
}

export function toCreateTripWaypointInput(
	waypoint: ConfigureTripWaypointFormItem
): CreateTripWaypointInput {
	return {
		...(waypoint.checkpointId ? { checkpointId: waypoint.checkpointId } : {}),
		type: waypoint.type,
		name: waypoint.name.trim() || waypointTypeFallbackNames[waypoint.type],
		location: {
			type: "Point",
			coordinates: [Number(waypoint.longitude), Number(waypoint.latitude)],
		},
		plannedAt: new Date(waypoint.plannedAt).toISOString(),
		...(waypoint.routeOrder ? { metadata: { routeOrder: waypoint.routeOrder } } : {}),
	};
}

function toIsoString(localDateTime: string): string {
	return new Date(localDateTime).toISOString();
}

export function toConfigureTripWaypointsInput(
	values: ConfigureTripWaypointsFormValues
): ConfigureTripWaypointsInput {
	return {
		waypoints: normalizeEndpointWaypoints(values.waypoints).map((waypoint) => ({
			...(waypoint.checkpointId ? { checkpointId: waypoint.checkpointId } : {}),
			type: waypoint.type,
			name: waypoint.name.trim() || waypointTypeFallbackNames[waypoint.type],
			location: {
				type: "Point",
				coordinates: [Number(waypoint.longitude), Number(waypoint.latitude)],
			},
			plannedAt: toIsoString(waypoint.plannedAt),
		})),
	};
}
