import { z } from "zod";
import type { HostOverview } from "./types";

const count = z.number().int().nonnegative();
const timestamp = z.string().datetime({ offset: true });
const risk = z.enum(["green", "yellow", "red"]);
const factor = z.object({
	value: z.union([z.number(), z.boolean()]),
	level: risk,
	weight: z.number(),
	score: z.number(),
});
const section = <T extends z.ZodType<unknown>>(item: T) =>
	z.object({
		availability: z.enum(["available", "unavailable"]),
		queriedAt: timestamp,
		source: z.string(),
		data: z.object({ total: count, items: z.array(item) }).nullable(),
	});

/** Validate transport shape only; operational states and KPI values remain server-owned. */
export const hostOverviewSchema: z.ZodType<HostOverview> = z.object({
	generatedAt: timestamp,
	timeZone: z.string(),
	bookingDate: z.string(),
	page: z.number().int().positive(),
	limit: z.number().int().positive(),
	kpis: z.object({
		todaysBookings: count.nullable(),
		activeTrips: count.nullable(),
		routes: count.nullable(),
		assignedPorters: count.nullable(),
		unresolvedSos: count.nullable(),
	}),
	bookings: section(
		z.object({
			id: z.string(),
			tripId: z.string(),
			status: z
				.enum([
					"pending_payment",
					"confirmed",
					"pending_reconfirmation",
					"cancelled",
					"expired",
					"completed",
				])
				.nullable(),
			paymentStatus: z.enum(["not_required", "unpaid", "paid"]).nullable(),
			numPeople: z.number().int().nullable(),
			createdAt: timestamp,
		})
	),
	activeTrips: section(
		z.object({
			id: z.string(),
			title: z.string(),
			routeId: z.string(),
			status: z.enum([
				"draft",
				"pending_approval",
				"published",
				"ongoing",
				"completed",
				"cancelled",
				"rejected",
			]),
			startsAt: timestamp,
			endsAt: timestamp,
			updatedAt: timestamp,
		})
	),
	routes: section(
		z.object({
			id: z.string(),
			name: z.string(),
			status: z.enum(["draft", "pending_approval", "active", "closed"]),
			updatedAt: timestamp,
		})
	),
	porters: section(
		z.object({
			id: z.string(),
			porterId: z.string(),
			assignments: z.array(
				z.object({
					tripId: z.string(),
					status: z.enum(["assigned", "pending_reconfirmation", "unassigned"]),
				})
			),
		})
	),
	sos: section(
		z.object({
			id: z.string(),
			tripId: z.string(),
			status: z.enum(["active", "acknowledged", "cancelled", "closed"]),
			emergencyType: z.enum(["medical", "injury", "lost", "natural_hazard", "other"]),
			eventTime: timestamp,
			receivedAt: timestamp,
			updatedAt: timestamp,
		})
	),
	weather: section(
		z.object({
			id: z.string(),
			routeId: z.string(),
			assessmentId: z.string().nullable(),
			riskLevel: risk.nullable(),
			criteriaScores: z
				.object({
					rainfall: factor,
					wind: factor,
					temperature: factor,
					visibility: factor,
					thunderstorm: factor,
				})
				.nullable(),
			assessedAt: timestamp.nullable(),
			observedAt: timestamp.nullable(),
			fetchedAt: timestamp.nullable(),
			state: z.enum(["available", "unavailable", "stale"]),
		})
	),
});
