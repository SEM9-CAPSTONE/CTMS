import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import { BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import { EmergencyType, SosStatus } from "../sos/sos.enums";
import { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../trips/entities/trip.entity";
import { RiskLevel } from "../weather/entities/weather-risk-assessment.entity";
import { OverviewAvailability, OverviewWeatherState } from "./host-overview.types";

const uuid: SchemaObject = { type: "string", format: "uuid" };
const timestamp: SchemaObject = { type: "string", format: "date-time" };
const count: SchemaObject = { type: "integer", minimum: 0 };
const text: SchemaObject = { type: "string" };
const enumeration = (values: string[]): SchemaObject => ({ type: "string", enum: values });
const object = (properties: Record<string, SchemaObject>): SchemaObject => ({
	type: "object",
	properties,
	required: Object.keys(properties),
	additionalProperties: false,
});
const section = (properties: Record<string, SchemaObject>): SchemaObject =>
	object({
		availability: enumeration(Object.values(OverviewAvailability)),
		queriedAt: timestamp,
		source: text,
		data: {
			...object({ total: count, items: { type: "array", items: object(properties) } }),
			nullable: true,
		},
	});

export const HOST_OVERVIEW_SCHEMA: SchemaObject = object({
	generatedAt: timestamp,
	timeZone: text,
	bookingDate: { type: "string", format: "date" },
	page: { type: "integer", minimum: 1 },
	limit: { type: "integer", minimum: 1, maximum: 100 },
	kpis: object({
		todaysBookings: { ...count, nullable: true },
		activeTrips: { ...count, nullable: true },
		routes: { ...count, nullable: true },
		assignedPorters: { ...count, nullable: true },
		unresolvedSos: { ...count, nullable: true },
	}),
	bookings: section({
		id: uuid,
		tripId: uuid,
		status: { ...enumeration(Object.values(BookingStatus)), nullable: true },
		paymentStatus: { ...enumeration(Object.values(BookingPaymentStatus)), nullable: true },
		numPeople: { type: "integer", nullable: true },
		createdAt: timestamp,
	}),
	activeTrips: section({
		id: uuid,
		title: text,
		routeId: uuid,
		status: enumeration(Object.values(TripStatus)),
		startsAt: timestamp,
		endsAt: timestamp,
		updatedAt: timestamp,
	}),
	routes: section({
		id: uuid,
		name: text,
		status: enumeration(Object.values(TrekkingRouteStatus)),
		updatedAt: timestamp,
	}),
	porters: section({
		id: uuid,
		porterId: uuid,
		assignments: {
			type: "array",
			items: object({ tripId: uuid, status: enumeration(Object.values(TripPorterStatus)) }),
		},
	}),
	sos: section({
		id: uuid,
		tripId: uuid,
		status: enumeration(Object.values(SosStatus)),
		emergencyType: enumeration(Object.values(EmergencyType)),
		eventTime: timestamp,
		receivedAt: timestamp,
		updatedAt: timestamp,
	}),
	weather: section({
		id: uuid,
		routeId: uuid,
		assessmentId: { ...uuid, nullable: true },
		riskLevel: { ...enumeration(Object.values(RiskLevel)), nullable: true },
		criteriaScores: {
			type: "object",
			nullable: true,
			additionalProperties: true,
			description:
				"Persisted criterion values, levels, weights and scores from the assessment; never recalculated by this endpoint.",
		},
		assessedAt: { ...timestamp, nullable: true },
		observedAt: { ...timestamp, nullable: true },
		fetchedAt: { ...timestamp, nullable: true },
		state: enumeration(Object.values(OverviewWeatherState)),
	}),
});
