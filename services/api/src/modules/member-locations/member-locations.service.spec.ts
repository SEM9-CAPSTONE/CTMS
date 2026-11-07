import { ConflictException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { SafetyEventType } from "../safety-events/safety-events.enums";
import { ScheduleStatus } from "../schedule-progress/schedule-progress.evaluator";
import type {
	ScheduleProgressResult,
	ScheduleProgressService,
} from "../schedule-progress/schedule-progress.service";
import type { MemberLocationsRepository } from "./member-locations.repository";
import { MemberLocationsService } from "./member-locations.service";
import {
	LocationFreshness,
	type MemberLocationRow,
	type MemberLocationsTrip,
	type SyncedLocation,
} from "./member-locations.types";

const NOW = new Date("2026-11-07T08:00:00.000Z");
const TRIP = "11111111-1111-4111-8111-111111111111";
const HOST = "host-1";
const PORTER = "porter-1";
const CAMPER_USER = "camper-user-1";

const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

const locationAt = (secondsAgo: number): SyncedLocation => ({
	id: "gps-1",
	latitude: 16,
	longitude: 108.2,
	accuracyMeters: 8,
	eventTime: ago(secondsAgo),
	receivedAt: ago(Math.max(secondsAgo - 10, 0)),
});

function camperRow(overrides: Partial<MemberLocationRow> = {}): MemberLocationRow {
	return {
		id: "member-1",
		userId: CAMPER_USER,
		name: "An",
		role: GpsParticipantRole.CAMPER,
		memberStatus: BookingMemberStatus.JOINED,
		location: locationAt(30),
		lastSyncedAt: ago(20),
		route: null,
		gps: null,
		lastCheckpoint: null,
		...overrides,
	};
}

function progress(members: ScheduleProgressResult["members"] = []): ScheduleProgressResult {
	return {
		tripId: TRIP,
		tripStatus: "ongoing",
		evaluatedAt: NOW,
		viewer: "team",
		configVersion: "v1",
		thresholds: {
			behindLagMinutes: 30,
			severelyBehindLagMinutes: 60,
			locationUnknownAfterMinutes: 5,
		},
		members,
	};
}

interface BuildOptions {
	trip?: MemberLocationsTrip | null;
	assignedPorter?: boolean;
	rows?: MemberLocationRow[];
	evaluation?: ScheduleProgressResult;
	maxAge?: string;
}

function build(options: BuildOptions = {}) {
	const trip =
		options.trip === undefined ? { id: TRIP, hostId: HOST, status: "ongoing" } : options.trip;
	const repository = {
		findTrip: jest.fn().mockResolvedValue(trip),
		isAssignedPorter: jest.fn().mockResolvedValue(options.assignedPorter ?? false),
		findMembers: jest.fn().mockResolvedValue(options.rows ?? [camperRow()]),
	};
	const schedule = { getProgress: jest.fn().mockResolvedValue(options.evaluation ?? progress()) };
	const config = { get: jest.fn().mockReturnValue(options.maxAge) } as unknown as ConfigService;
	const service = new MemberLocationsService(
		repository as unknown as MemberLocationsRepository,
		schedule as unknown as ScheduleProgressService,
		config
	);
	jest.spyOn(service, "now").mockReturnValue(NOW);
	return { service, repository, schedule };
}

describe("MemberLocationsService (CTMS-066 / Jira CTMS-329)", () => {
	describe("authorization (BR-172/173)", () => {
		it("lets the Trip Host read the projection", async () => {
			const { service, repository } = build();
			const result = await service.getMemberLocations(HOST, TRIP);
			expect(result.viewer).toBe("host");
			expect(repository.isAssignedPorter).not.toHaveBeenCalled();
		});

		it("lets an assigned Porter read the projection", async () => {
			const { service } = build({ assignedPorter: true });
			await expect(service.getMemberLocations(PORTER, TRIP)).resolves.toMatchObject({
				viewer: "porter",
			});
		});

		it("hides the Trip from an unrelated Host or unassigned Porter without reading members", async () => {
			const { service, repository, schedule } = build();
			await expect(service.getMemberLocations("other-host", TRIP)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(repository.findMembers).not.toHaveBeenCalled();
			expect(schedule.getProgress).not.toHaveBeenCalled();
		});

		it("returns 404 for an absent Trip", async () => {
			const { service } = build({ trip: null });
			await expect(service.getMemberLocations(HOST, TRIP)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});

		it("rejects a Trip that is not ongoing, after authorization", async () => {
			const { service, repository } = build({
				trip: { id: TRIP, hostId: HOST, status: "completed" },
			});
			await expect(service.getMemberLocations(HOST, TRIP)).rejects.toBeInstanceOf(
				ConflictException
			);
			expect(repository.findMembers).not.toHaveBeenCalled();
		});
	});

	describe("freshness (approved threshold, never real-time)", () => {
		it.each([
			[0, LocationFreshness.FRESH],
			[120, LocationFreshness.FRESH],
			[121, LocationFreshness.STALE],
			[3600, LocationFreshness.STALE],
		])("a capture %i s old is %s", async (age, expected) => {
			const { service } = build({ rows: [camperRow({ location: locationAt(age) })] });
			const [member] = (await service.getMemberLocations(HOST, TRIP)).members;
			expect(member.freshness).toBe(expected);
			expect(member.locationAgeSeconds).toBe(age);
			expect(member.lastSeenAt).toBe(ago(age));
		});

		it("never calls a future-dated capture fresh", async () => {
			const { service } = build({ rows: [camperRow({ location: locationAt(-60) })] });
			const [member] = (await service.getMemberLocations(HOST, TRIP)).members;
			expect(member.freshness).toBe(LocationFreshness.STALE);
			expect(member.locationAgeSeconds).toBe(0);
		});

		it("reports no server-known location for a member who never synced", async () => {
			const { service } = build({ rows: [camperRow({ location: null, lastSyncedAt: null })] });
			const [member] = (await service.getMemberLocations(HOST, TRIP)).members;
			expect(member).toMatchObject({
				location: null,
				lastSeenAt: null,
				lastSyncedAt: null,
				freshness: LocationFreshness.UNAVAILABLE,
				locationAgeSeconds: null,
			});
		});

		it("uses the configured threshold and labels the source as server-confirmed", async () => {
			const { service } = build({
				rows: [camperRow({ location: locationAt(200) })],
				maxAge: "300",
			});
			const result = await service.getMemberLocations(HOST, TRIP);
			expect(result).toMatchObject({
				freshnessMaxAgeSeconds: 300,
				locationSource: "server_confirmed",
				generatedAt: NOW.toISOString(),
			});
			expect(result.members[0].freshness).toBe(LocationFreshness.FRESH);
		});

		it("refuses an invalid threshold at start-up", () => {
			expect(() => build({ maxAge: "0" })).toThrow(/positive safe integer/);
			expect(() => build({ maxAge: "abc" })).toThrow(/positive safe integer/);
		});

		it("normalizes lastSyncedAt from a database timestamp to ISO", async () => {
			const raw = new Date(ago(20)) as unknown as string;
			const { service } = build({ rows: [camperRow({ lastSyncedAt: raw })] });
			const [member] = (await service.getMemberLocations(HOST, TRIP)).members;
			expect(member.lastSyncedAt).toBe(ago(20));
		});
	});

	describe("synchronized safety flags (BR-246)", () => {
		it("passes through synced route, GPS and checkpoint context", async () => {
			const route = { type: SafetyEventType.OFF_ROUTE, eventTime: ago(90), receivedAt: ago(60) };
			const gps = { type: SafetyEventType.GPS_RESTORED, eventTime: ago(50), receivedAt: ago(40) };
			const lastCheckpoint = {
				checkpointId: "cp-1",
				checkpointName: "Đèo Gió",
				arrivedAt: ago(600),
				receivedAt: ago(590),
			};
			const { service } = build({ rows: [camperRow({ route, gps, lastCheckpoint })] });
			const [member] = (await service.getMemberLocations(HOST, TRIP)).members;
			expect(member.safety).toMatchObject({ route, gps, lastCheckpoint });
		});

		it("attaches the server's behind-schedule evaluation to the matching Camper only", async () => {
			const porterRow = camperRow({
				id: PORTER,
				userId: PORTER,
				role: GpsParticipantRole.PORTER,
				memberStatus: null,
			});
			const guestRow = camperRow({ id: "member-guest", userId: null, location: null });
			const evaluation = progress([
				{
					userId: CAMPER_USER,
					fullName: "An",
					status: ScheduleStatus.BEHIND,
					reference: {
						checkpointId: "cp-2",
						checkpointName: "Trạm nghỉ suối",
						porterArrivedAt: new Date(ago(2100)),
					},
					lagMinutes: 35,
					safeCheckpoint: { id: "cp-2", name: "Trạm nghỉ suối", type: "rest" },
					guidance: "Tiếp tục tới Trạm nghỉ suối.",
					lastValidSampleAt: new Date(ago(30)),
					levelsReached: [],
				},
			]);
			const { service, schedule } = build({ rows: [camperRow(), guestRow, porterRow], evaluation });
			const [camper, guest, porter] = (await service.getMemberLocations(HOST, TRIP)).members;
			expect(schedule.getProgress).toHaveBeenCalledWith(HOST, TRIP);
			expect(camper.safety.behindSchedule).toEqual({
				status: ScheduleStatus.BEHIND,
				lagMinutes: 35,
				reference: {
					checkpointId: "cp-2",
					checkpointName: "Trạm nghỉ suối",
					porterArrivedAt: ago(2100),
				},
				safeCheckpoint: { id: "cp-2", name: "Trạm nghỉ suối", type: "rest" },
				evaluatedAt: NOW.toISOString(),
			});
			expect(guest.safety.behindSchedule).toBeNull();
			expect(porter.safety.behindSchedule).toBeNull();
		});

		it("leaves behindSchedule null when no evaluation exists rather than implying on-track", async () => {
			const { service } = build({ evaluation: progress([]) });
			const [member] = (await service.getMemberLocations(HOST, TRIP)).members;
			expect(member.safety.behindSchedule).toBeNull();
		});
	});
});
