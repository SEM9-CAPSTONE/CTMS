import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { SafetyEventType } from "../safety-events/safety-events.enums";
import { CheckpointType } from "../trekking-routes/entities/checkpoint.entity";
import { LocationFreshness } from "./host-trip-map.types";

const uuid: SchemaObject = { type: "string", format: "uuid" };
const timestamp: SchemaObject = { type: "string", format: "date-time" };
const text: SchemaObject = { type: "string" };
const number: SchemaObject = { type: "number" };
const enumeration = (values: string[]): SchemaObject => ({ type: "string", enum: values });
const object = (properties: Record<string, SchemaObject>): SchemaObject => ({
	type: "object",
	properties,
	required: Object.keys(properties),
	additionalProperties: false,
});
const array = (items: SchemaObject): SchemaObject => ({ type: "array", items });
const point = object({
	type: enumeration(["Point"]),
	coordinates: { ...array(number), minItems: 2, maxItems: 2 },
});
const transition = {
	...object({
		type: enumeration(Object.values(SafetyEventType)),
		eventTime: timestamp,
		receivedAt: timestamp,
	}),
	nullable: true,
};
const participant = object({
	id: uuid,
	userId: { ...uuid, nullable: true },
	name: { ...text, nullable: true },
	role: enumeration(Object.values(GpsParticipantRole)),
	memberStatus: { ...enumeration(Object.values(BookingMemberStatus)), nullable: true },
	location: {
		...object({
			id: uuid,
			latitude: number,
			longitude: number,
			accuracyMeters: number,
			eventTime: timestamp,
			receivedAt: timestamp,
		}),
		nullable: true,
	},
	lastSeenAt: { ...timestamp, nullable: true },
	freshness: enumeration(Object.values(LocationFreshness)),
	locationAgeSeconds: { type: "integer", minimum: 0, nullable: true },
	safety: object({
		route: transition,
		gps: transition,
		lastCheckpoint: {
			...object({ checkpointId: uuid, arrivedAt: timestamp, receivedAt: timestamp }),
			nullable: true,
		},
		behindSchedule: {
			type: "boolean",
			nullable: true,
			description: "Always null: no authoritative behind-schedule source is available yet.",
		},
	}),
});
const metadata = {
	generatedAt: timestamp,
	freshnessMaxAgeSeconds: { type: "integer", minimum: 1 } as SchemaObject,
	locationSource: enumeration(["server_confirmed"]),
};
export const MAP_PARTICIPANT_DETAIL_SCHEMA = object({ ...metadata, tripId: uuid, participant });
export const HOST_TRIP_MAP_SCHEMA = object({
	...metadata,
	page: { type: "integer", minimum: 1 },
	limit: { type: "integer", minimum: 1, maximum: 100 },
	total: { type: "integer", minimum: 0 },
	items: array(
		object({
			id: uuid,
			title: text,
			startsAt: timestamp,
			endsAt: timestamp,
			route: object({
				id: uuid,
				name: text,
				geometry: object({
					type: enumeration(["LineString"]),
					coordinates: array({ ...array(number), minItems: 2, maxItems: 2 }),
				}),
				checkpoints: array(
					object({
						id: uuid,
						name: text,
						type: enumeration(Object.values(CheckpointType)),
						location: point,
						radiusMeters: number,
						routePosition: number,
					})
				),
			}),
			participants: array(participant),
		})
	),
});
