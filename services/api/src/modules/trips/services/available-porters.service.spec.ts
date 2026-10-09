import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { IntendedPorterRole } from "../dto/available-porters-query.dto";
import type { AvailablePortersRepository } from "../repositories/available-porters.repository";
import type { PorterScheduleConflictSource } from "../repositories/porter-schedule-conflict-source";
import type { TripsRepository } from "../repositories/trips.repository";
import { AvailablePortersService } from "./available-porters.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_HOST_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const ROUTE_ID = "44444444-4444-4444-8444-444444444444";
const STARTS_AT = new Date("2035-01-10T08:00:00.000Z");
const ENDS_AT = new Date("2035-01-10T16:00:00.000Z");

describe("AvailablePortersService", () => {
	let tripsRepository: { findPorterAvailabilityContext: jest.Mock };
	let availablePortersRepository: { findEligibleCandidates: jest.Mock };
	let scheduleConflictSource: { findConflictingPorterIds: jest.Mock };
	let service: AvailablePortersService;

	beforeEach(() => {
		tripsRepository = {
			findPorterAvailabilityContext: jest.fn().mockResolvedValue({
				id: TRIP_ID,
				hostId: HOST_ID,
				routeId: ROUTE_ID,
				startsAt: STARTS_AT,
				endsAt: ENDS_AT,
			}),
		};
		availablePortersRepository = {
			findEligibleCandidates: jest.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		scheduleConflictSource = {
			findConflictingPorterIds: jest.fn().mockResolvedValue([]),
		};
		service = new AvailablePortersService(
			tripsRepository as unknown as TripsRepository,
			availablePortersRepository as unknown as AvailablePortersRepository,
			scheduleConflictSource as unknown as PorterScheduleConflictSource
		);
	});

	it("searches an owned Trip with reusable eligibility inputs and pagination", async () => {
		availablePortersRepository.findEligibleCandidates.mockResolvedValue({
			items: [
				{
					porterId: "55555555-5555-4555-8555-555555555555",
					displayName: "Eligible Porter",
					experienceYears: 4,
					availabilityStatus: "available",
					ratingAvg: 4.5,
					completedTrips: 8,
					proficiency: "expert",
				},
			],
			total: 21,
		});
		scheduleConflictSource.findConflictingPorterIds.mockResolvedValue([
			"66666666-6666-4666-8666-666666666666",
		]);

		const result = await service.search(HOST_ID, TRIP_ID, {
			role: IntendedPorterRole.LEAD,
			minExperienceYears: 4,
			page: 2,
			limit: 20,
		});

		expect(scheduleConflictSource.findConflictingPorterIds).toHaveBeenCalledWith({
			tripId: TRIP_ID,
			startsAt: STARTS_AT,
			endsAt: ENDS_AT,
		});
		expect(availablePortersRepository.findEligibleCandidates).toHaveBeenCalledWith({
			routeId: ROUTE_ID,
			role: IntendedPorterRole.LEAD,
			minExperienceYears: 4,
			excludedPorterIds: ["66666666-6666-4666-8666-666666666666"],
			page: 2,
			limit: 20,
		});
		expect(result.pagination).toEqual({ page: 2, limit: 20, total: 21, totalPages: 2 });
	});

	it("returns an empty successful page", async () => {
		await expect(
			service.search(HOST_ID, TRIP_ID, {
				role: IntendedPorterRole.SUPPORT,
				page: 1,
				limit: 20,
			})
		).resolves.toEqual({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});
	});

	it("returns 404 for a missing Trip", async () => {
		tripsRepository.findPorterAvailabilityContext.mockResolvedValue(null);

		await expect(
			service.search(HOST_ID, TRIP_ID, {
				role: IntendedPorterRole.SUPPORT,
				page: 1,
				limit: 20,
			})
		).rejects.toBeInstanceOf(NotFoundException);
		expect(scheduleConflictSource.findConflictingPorterIds).not.toHaveBeenCalled();
	});

	it("returns 403 for a foreign Host", async () => {
		await expect(
			service.search(OTHER_HOST_ID, TRIP_ID, {
				role: IntendedPorterRole.SUPPORT,
				page: 1,
				limit: 20,
			})
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(scheduleConflictSource.findConflictingPorterIds).not.toHaveBeenCalled();
	});

	it.each([
		{ routeId: null, startsAt: STARTS_AT, endsAt: ENDS_AT },
		{ routeId: ROUTE_ID, startsAt: null, endsAt: ENDS_AT },
		{ routeId: ROUTE_ID, startsAt: STARTS_AT, endsAt: null },
		{ routeId: ROUTE_ID, startsAt: ENDS_AT, endsAt: STARTS_AT },
	])("rejects incomplete or invalid authoritative Trip context", async (invalid) => {
		tripsRepository.findPorterAvailabilityContext.mockResolvedValue({
			id: TRIP_ID,
			hostId: HOST_ID,
			...invalid,
		});

		await expect(
			service.search(HOST_ID, TRIP_ID, {
				role: IntendedPorterRole.SUPPORT,
				page: 1,
				limit: 20,
			})
		).rejects.toBeInstanceOf(ConflictException);
		expect(scheduleConflictSource.findConflictingPorterIds).not.toHaveBeenCalled();
	});
});
