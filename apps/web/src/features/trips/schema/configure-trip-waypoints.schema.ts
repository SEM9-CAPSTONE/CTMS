import { z } from "zod";
import type { ConfigureTripWaypointsInput, Trip, TripWaypointType } from "../types";
import { TRIP_WAYPOINT_TYPES } from "../types";

const coordinateMessage = "Tọa độ phải nằm trong phạm vi hợp lệ";

const positiveIntegerString = (message: string) =>
	z
		.string()
		.trim()
		.regex(/^\d+$/, message)
		.refine((value) => Number(value) > 0, message);

const optionalPositiveIntegerString = (message: string) =>
	z
		.string()
		.trim()
		.refine((value) => value === "" || /^\d+$/.test(value), message)
		.refine((value) => value === "" || Number(value) > 0, message);

const coordinateString = z
	.string()
	.trim()
	.regex(/^-?\d+(\.\d+)?$/, coordinateMessage);

export interface ConfigureTripWaypointFormItem {
	checkpointId: string;
	type: TripWaypointType;
	name: string;
	longitude: string;
	latitude: string;
	dayNumber: string;
	sequenceOrder: string;
	plannedAt: string;
	durationMinutes: string;
}

export interface ConfigureTripWaypointsFormValues {
	waypoints: ConfigureTripWaypointFormItem[];
}

export function createConfigureTripWaypointsSchema(trip: Trip) {
	return z
		.object({
			waypoints: z
				.array(
					z.object({
						checkpointId: z.string(),
						type: z.enum(TRIP_WAYPOINT_TYPES),
						name: z.string().trim().min(1, "Tên waypoint là bắt buộc").max(150),
						longitude: coordinateString.refine(
							(value) => Math.abs(Number(value)) <= 180,
							"Kinh độ phải từ -180 đến 180"
						),
						latitude: coordinateString.refine(
							(value) => Math.abs(Number(value)) <= 90,
							"Vĩ độ phải từ -90 đến 90"
						),
						dayNumber: positiveIntegerString("Ngày phải là số nguyên dương"),
						sequenceOrder: positiveIntegerString("Thứ tự phải là số nguyên dương"),
						plannedAt: z.string(),
						durationMinutes: optionalPositiveIntegerString(
							"Thời lượng dừng phải là số nguyên dương"
						),
					})
				)
				.min(2, "Trip cần ít nhất điểm bắt đầu và điểm kết thúc"),
		})
		.superRefine((values, context) => {
			const startsAt = new Date(trip.startsAt);
			const endsAt = new Date(trip.endsAt);
			const maxDayNumber = trip.durationNights + 1;
			const startWaypoints = values.waypoints.filter((waypoint) => waypoint.type === "start");
			const finishWaypoints = values.waypoints.filter((waypoint) => waypoint.type === "finish");
			const overnightWaypoints = values.waypoints.filter(
				(waypoint) => waypoint.type === "overnight"
			);

			if (startWaypoints.length !== 1) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints"],
					message: "Trip phải có đúng một waypoint bắt đầu",
				});
			}
			if (finishWaypoints.length !== 1) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints"],
					message: "Trip phải có đúng một waypoint kết thúc",
				});
			}
			if (trip.tripType === "day_trip" && overnightWaypoints.length > 0) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints"],
					message: "Trip trong ngày không được có waypoint qua đêm",
				});
			}
			if (trip.tripType === "overnight" && overnightWaypoints.length !== trip.durationNights) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints"],
					message: `Trip qua đêm cần đúng ${trip.durationNights} waypoint qua đêm`,
				});
			}

			const sequenceOrders = new Set<string>();
			values.waypoints.forEach((waypoint, index) => {
				if (sequenceOrders.has(waypoint.sequenceOrder)) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["waypoints", index, "sequenceOrder"],
						message: "Thứ tự waypoint không được trùng",
					});
				}
				sequenceOrders.add(waypoint.sequenceOrder);
				if (Number(waypoint.dayNumber) > maxDayNumber) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["waypoints", index, "dayNumber"],
						message: "Ngày waypoint phải nằm trong thời lượng trip",
					});
				}
				if (!waypoint.plannedAt) return;
				const plannedAt = new Date(waypoint.plannedAt);
				if (plannedAt < startsAt || plannedAt > endsAt) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["waypoints", index, "plannedAt"],
						message: "Thời gian waypoint phải nằm trong lịch trình trip",
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

export function toConfigureTripWaypointsDefaultValues(
	trip: Trip
): ConfigureTripWaypointsFormValues {
	return {
		waypoints: trip.waypoints.map((waypoint) => ({
			checkpointId: waypoint.checkpointId ?? "",
			type: waypoint.type,
			name: waypoint.name,
			longitude: String(waypoint.location.coordinates[0]),
			latitude: String(waypoint.location.coordinates[1]),
			dayNumber: String(waypoint.dayNumber),
			sequenceOrder: String(waypoint.sequenceOrder),
			plannedAt: toDateTimeLocalValue(waypoint.plannedAt),
			durationMinutes: waypoint.durationMinutes == null ? "" : String(waypoint.durationMinutes),
		})),
	};
}

function toIsoString(localDateTime: string): string {
	return new Date(localDateTime).toISOString();
}

export function toConfigureTripWaypointsInput(
	values: ConfigureTripWaypointsFormValues
): ConfigureTripWaypointsInput {
	return {
		waypoints: values.waypoints.map((waypoint) => ({
			...(waypoint.checkpointId ? { checkpointId: waypoint.checkpointId } : {}),
			type: waypoint.type,
			name: waypoint.name.trim(),
			location: {
				type: "Point",
				coordinates: [Number(waypoint.longitude), Number(waypoint.latitude)],
			},
			dayNumber: Number(waypoint.dayNumber),
			sequenceOrder: Number(waypoint.sequenceOrder),
			...(waypoint.plannedAt ? { plannedAt: toIsoString(waypoint.plannedAt) } : {}),
			...(waypoint.durationMinutes ? { durationMinutes: Number(waypoint.durationMinutes) } : {}),
		})),
	};
}
