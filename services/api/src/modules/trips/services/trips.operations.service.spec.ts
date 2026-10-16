import { NotFoundException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import type { PorterRecordedWeather } from "../dto/porter-trip-operations-response.dto";
import { TripStatus } from "../entities/trip.entity";
import type { TripsRepository } from "../repositories/trips.repository";
import { TripsService } from "./trips.service";

const NOW = "2035-01-01T12:00:00.000Z";
function setup(recordedWeather: PorterRecordedWeather | null) {
	const row = {
		tripId: "trip",
		title: "Assigned",
		status: TripStatus.ONGOING,
		startsAt: new Date(NOW),
		endsAt: new Date("2035-01-01T20:00:00Z"),
		meetingAt: null,
		meetingPoint: null,
		meetingPointName: null,
		waypoints: [],
		routeName: "Route",
		updatedAt: new Date(NOW),
		retrievedAt: new Date(NOW),
		assignmentStatus: "assigned" as const,
		route: null,
		members: [],
		recordedWeather,
	};
	const repository = { findPorterTripOperations: jest.fn().mockResolvedValue(row) };
	return {
		row,
		repository,
		service: new TripsService(repository as unknown as TripsRepository, {} as DataSource),
	};
}
function weather(overrides: Partial<PorterRecordedWeather> = {}): PorterRecordedWeather {
	return {
		status: "success",
		observedAt: NOW,
		fetchedAt: NOW,
		rainfallMm: 0,
		windKph: 0,
		temperatureC: 0,
		visibilityM: 10000,
		thunderstorm: false,
		riskLevel: null,
		...overrides,
	};
}

describe("CTMS-48 assigned Trip operational projection", () => {
	it("does not fall back to public Trip data when no valid scoped Assignment exists", async () => {
		const h = setup(null);
		h.repository.findPorterTripOperations.mockResolvedValue(null);
		await expect(h.service.getAssignedTripOperations("porter", "trip")).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(h.repository.findPorterTripOperations).toHaveBeenCalledWith("porter", "trip");
	});
	it("returns the authoritative schedule and explicitly unavailable offline state", async () => {
		const h = setup(weather());
		const result = await h.service.getAssignedTripOperations("porter", "trip");
		expect(result.status).toBe(TripStatus.ONGOING);
		expect(result.offlinePackage).toEqual({ status: "unavailable", downloadedAt: null });
		expect(result.weather.availability).toBe("recorded");
		expect(result.weather.record).toMatchObject({
			temperatureC: 0,
			rainfallMm: 0,
			windKph: 0,
			thunderstorm: false,
			riskLevel: null,
		});
		expect(result).not.toHaveProperty("recordedWeather");
	});
	it.each([
		[59 * 60_000 + 59_999, "recorded"],
		[60 * 60_000, "stale"],
		[120 * 60_000, "stale"],
		[-1, "unavailable"],
	])("labels observation age %s as %s", async (age, availability) => {
		const h = setup(weather({ observedAt: new Date(Date.parse(NOW) - Number(age)).toISOString() }));
		const result = await h.service.getAssignedTripOperations("porter", "trip");
		expect(result.weather.availability).toBe(availability);
	});
	it.each([
		null,
		weather({ status: "failed", riskLevel: RiskLevel.GREEN }),
		weather({ observedAt: null }),
		weather({ observedAt: "invalid" }),
		weather({ temperatureC: null }),
		weather({ rainfallMm: null }),
		weather({ windKph: null }),
		weather({ visibilityM: null }),
	])("does not confirm unavailable or incomplete weather %#", async (record) => {
		const h = setup(record);
		const result = await h.service.getAssignedTripOperations("porter", "trip");
		expect(result.weather).toMatchObject({ availability: "unavailable", record: null });
	});
});
