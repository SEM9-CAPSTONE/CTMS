import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { HostTripMapQueryDto } from "./host-trip-map.dto";
import { HostTripMapRepository } from "./host-trip-map.repository";
import { HostTripMapService } from "./host-trip-map.service";
import { LocationFreshness, type MapParticipantRow, type MapTripRow } from "./host-trip-map.types";

describe("HostTripMapService (CTMS-369)", () => {
	const actor = { userId: "host", roles: [UserRole.HOST], status: UserStatus.ACTIVE };
	const read = jest.fn();
	let service: HostTripMapService;
	const participant = (eventTime: string | null): MapParticipantRow => ({
		id: "member",
		userId: "camper",
		name: null,
		role: GpsParticipantRole.CAMPER,
		memberStatus: BookingMemberStatus.JOINED,
		location: eventTime
			? {
					id: "gps",
					latitude: 11,
					longitude: 108,
					accuracyMeters: 5,
					eventTime,
					receivedAt: "2026-10-29T10:00:00Z",
				}
			: null,
		safety: { route: null, gps: null, lastCheckpoint: null, behindSchedule: null },
	});
	const trip = (participants: MapParticipantRow[]): MapTripRow => ({
		id: "trip",
		title: "Trip",
		startsAt: "2026-10-29T00:00:00Z",
		endsAt: "2026-10-30T00:00:00Z",
		route: {
			id: "route",
			name: "Route",
			geometry: { type: "LineString", coordinates: [] },
			checkpoints: [],
		},
		participants,
	});
	beforeEach(async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-10-29T10:00:00Z"));
		read.mockReset().mockResolvedValue({ total: 0, items: [] });
		const module = await Test.createTestingModule({
			providers: [
				HostTripMapService,
				{ provide: HostTripMapRepository, useValue: { read } },
				{
					provide: ConfigService,
					useValue: new ConfigService({ HOST_TRIP_MAP_FRESHNESS_MAX_AGE_SECONDS: 120 }),
				},
			],
		}).compile();
		service = module.get(HostTripMapService);
	});
	afterEach(() => jest.useRealTimers());
	describe("getMap", () => {
		it.each([UserRole.ADMIN, UserRole.CAMPER, UserRole.PORTER])(
			"rejects %s before querying private data",
			async (role) => {
				await expect(
					service.getMap({ ...actor, roles: [role] }, new HostTripMapQueryDto())
				).rejects.toBeInstanceOf(ForbiddenException);
				expect(read).not.toHaveBeenCalled();
			}
		);
		it("rejects suspended Hosts", async () => {
			await expect(
				service.getMap({ ...actor, status: UserStatus.SUSPENDED }, new HostTripMapQueryDto())
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(read).not.toHaveBeenCalled();
		});
		it.each([
			["2026-10-29T09:59:00Z", LocationFreshness.FRESH, 60],
			["2026-10-29T09:58:00Z", LocationFreshness.FRESH, 120],
			["2026-10-29T09:57:59Z", LocationFreshness.STALE, 121],
			["2026-10-29T10:00:01Z", LocationFreshness.STALE, 0],
			[null, LocationFreshness.UNAVAILABLE, null],
		])(
			"classifies capture time %s independently of recent upload",
			async (eventTime, freshness, age) => {
				read.mockResolvedValue({ total: 1, items: [trip([participant(eventTime)])] });
				const result = await service.getMap(actor, new HostTripMapQueryDto());
				expect(result.items[0].participants[0]).toMatchObject({
					freshness,
					lastSeenAt: eventTime,
					locationAgeSeconds: age,
				});
				expect(result.locationSource).toBe("server_confirmed");
			}
		);
		it("passes Host scope and pagination and preserves an empty page total", async () => {
			read.mockResolvedValue({ total: 5, items: [] });
			expect(await service.getMap(actor, { page: 9, limit: 2 })).toMatchObject({
				total: 5,
				items: [],
				page: 9,
				limit: 2,
			});
			expect(read).toHaveBeenCalledWith(actor.userId, 9, 2, null);
		});
	});
	describe("getParticipant", () => {
		it("returns the same server-confirmed projection from the permitted Trip", async () => {
			read.mockResolvedValue({ total: 1, items: [trip([participant(null)])] });
			expect(
				await service.getParticipant(actor, "trip", GpsParticipantRole.CAMPER, "member")
			).toMatchObject({
				tripId: "trip",
				participant: { id: "member", freshness: LocationFreshness.UNAVAILABLE },
			});
			expect(read).toHaveBeenCalledWith(actor.userId, 1, 1, "trip");
		});
		it("hides absent or unauthorized Trips", async () => {
			await expect(
				service.getParticipant(actor, "foreign", GpsParticipantRole.CAMPER, "member")
			).rejects.toBeInstanceOf(NotFoundException);
		});
		it("does not confuse member identifiers with Porter identifiers", async () => {
			read.mockResolvedValue({ total: 1, items: [trip([participant(null)])] });
			await expect(
				service.getParticipant(actor, "trip", GpsParticipantRole.PORTER, "member")
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});
	it.each([0, -1, 1.5, "invalid", Number.POSITIVE_INFINITY])(
		"rejects invalid freshness config %s",
		(value) => {
			expect(
				() =>
					new HostTripMapService(
						{ read } as unknown as HostTripMapRepository,
						new ConfigService({ HOST_TRIP_MAP_FRESHNESS_MAX_AGE_SECONDS: value })
					)
			).toThrow("positive safe integer");
		}
	);
});
