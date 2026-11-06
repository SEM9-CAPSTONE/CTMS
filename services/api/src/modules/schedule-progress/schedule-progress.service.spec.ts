import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
import { BehindScheduleLevel, ScheduleStatus } from "./schedule-progress.evaluator";
import type { ScheduleProgressRepository } from "./schedule-progress.repository";
import { ScheduleProgressService } from "./schedule-progress.service";

const TRIP_ID = "44444444-4444-4444-8444-444444444444";
const HOST_ID = "host";
const T_X = new Date("2026-11-07T03:00:00.000Z");
const NOW = new Date(T_X.getTime() + 65 * 60_000);

describe("ScheduleProgressService (CTMS-063 / Jira CTMS-319)", () => {
	let repository: Record<string, jest.Mock>;
	let participation: { findPorterAssignment: jest.Mock; findCamperParticipation: jest.Mock };
	let service: ScheduleProgressService;

	beforeEach(() => {
		repository = {
			findTrip: jest.fn().mockResolvedValue({
				id: TRIP_ID,
				hostId: HOST_ID,
				status: "ongoing",
				routeId: "route",
				routeVersion: "rv",
			}),
			findJoinedCampers: jest.fn().mockResolvedValue([
				{ userId: "camper-a", fullName: "A" },
				{ userId: "camper-b", fullName: "B" },
			]),
			findCheckpoints: jest.fn().mockResolvedValue([
				{
					id: "cp",
					name: "Trạm nghỉ",
					type: "rest",
					nearbyWaterOrShelter: false,
					routeFraction: 0.5,
					latitude: 16.05,
					longitude: 108.2,
				},
			]),
			findPorterBaselines: jest.fn().mockResolvedValue(new Map([["cp", T_X]])),
			findPassedCheckpoints: jest.fn().mockResolvedValue(new Map([["camper-b", new Set(["cp"])]])),
			findLastValidSamples: jest.fn().mockResolvedValue(
				new Map([
					[
						"camper-a",
						{
							eventTime: new Date(NOW.getTime() - 60_000),
							latitude: 16.04,
							longitude: 108.2,
							accuracyMeters: 9,
							routeFraction: 0.4,
						},
					],
				])
			),
			recordWarnings: jest.fn().mockResolvedValue(undefined),
		};
		participation = {
			findPorterAssignment: jest.fn().mockResolvedValue(null),
			findCamperParticipation: jest.fn().mockResolvedValue(null),
		};
		service = new ScheduleProgressService(
			repository as unknown as ScheduleProgressRepository,
			participation as unknown as GpsParticipationSource
		);
		jest.spyOn(service, "now").mockReturnValue(NOW);
	});

	it("gives the Trip Host every joined Camper's status", async () => {
		const result = await service.getProgress(HOST_ID, TRIP_ID);

		expect(result.viewer).toBe("team");
		expect(result.members.map((m) => [m.userId, m.status])).toEqual([
			["camper-a", ScheduleStatus.SEVERELY_BEHIND],
			["camper-b", ScheduleStatus.ON_TRACK],
		]);
	});

	it("gives an assigned Porter every Camper's status", async () => {
		participation.findPorterAssignment.mockResolvedValue({ assigned: true });

		const result = await service.getProgress("porter", TRIP_ID);

		expect(result.viewer).toBe("team");
		expect(result.members).toHaveLength(2);
	});

	it("gives a Camper only their own status", async () => {
		participation.findCamperParticipation.mockResolvedValue({ memberStatus: "joined" });

		const result = await service.getProgress("camper-b", TRIP_ID);

		expect(result.viewer).toBe("camper");
		expect(result.members.map((m) => m.userId)).toEqual(["camper-b"]);
		expect(repository.findLastValidSamples).toHaveBeenCalledWith(TRIP_ID, "route", ["camper-b"]);
	});

	it.each([
		["an unassigned Porter", { assigned: false }, null],
		["an unrelated user", null, null],
	])("refuses %s", async (_label, porter, camper) => {
		participation.findPorterAssignment.mockResolvedValue(porter);
		participation.findCamperParticipation.mockResolvedValue(camper);

		await expect(service.getProgress("someone", TRIP_ID)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(repository.recordWarnings).not.toHaveBeenCalled();
	});

	it("returns 404 for an unknown Trip", async () => {
		repository.findTrip.mockResolvedValue(null);

		await expect(service.getProgress(HOST_ID, TRIP_ID)).rejects.toBeInstanceOf(NotFoundException);
	});

	it("does not evaluate or record anything while the Trip is not ongoing", async () => {
		repository.findTrip.mockResolvedValue({
			id: TRIP_ID,
			hostId: HOST_ID,
			status: "completed",
			routeId: "route",
			routeVersion: "rv",
		});

		const result = await service.getProgress(HOST_ID, TRIP_ID);

		expect(result.members).toEqual([]);
		expect(repository.findJoinedCampers).not.toHaveBeenCalled();
		expect(repository.recordWarnings).not.toHaveBeenCalled();
	});

	it("records each reached level once, timed at the moment the level was reached", async () => {
		await service.getProgress(HOST_ID, TRIP_ID);

		expect(repository.recordWarnings).toHaveBeenCalledWith([
			expect.objectContaining({
				userId: "camper-a",
				checkpointId: "cp",
				level: BehindScheduleLevel.BEHIND,
				eventTime: new Date(T_X.getTime() + 30 * 60_000),
				routeVersion: "rv",
			}),
			expect.objectContaining({
				userId: "camper-a",
				checkpointId: "cp",
				level: BehindScheduleLevel.SEVERELY_BEHIND,
				eventTime: new Date(T_X.getTime() + 60 * 60_000),
			}),
		]);
	});

	it("only asks for passage of Porter-confirmed Checkpoints", async () => {
		await service.getProgress(HOST_ID, TRIP_ID);

		expect(repository.findPassedCheckpoints).toHaveBeenCalledWith(
			TRIP_ID,
			"route",
			["camper-a", "camper-b"],
			["cp"]
		);
	});
});
