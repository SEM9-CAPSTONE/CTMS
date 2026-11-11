import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { CheckpointType } from "../../trekking-routes/entities/checkpoint.entity";
import type { ConfirmCheckpointArrivalDto } from "../dto/confirm-checkpoint-arrival.dto";
import type { SyncCheckpointArrivalsDto } from "../dto/sync-checkpoint-arrivals.dto";
import type { TripOperationalProgressResponseDto } from "../dto/trip-operational-progress-response.dto";
import { TripStatus } from "../entities/trip.entity";
import type {
	CheckpointVisitsRepository,
	JoinedMemberRow,
	TripContextRow,
	UpsertCheckpointVisitItem,
} from "../repositories/checkpoint-visits.repository";
import { CheckpointVisitsService } from "./checkpoint-visits.service";

describe("CheckpointVisitsService (CTMS-056 / BR-234)", () => {
	let service: CheckpointVisitsService;
	let repository: jest.Mocked<CheckpointVisitsRepository>;

	const porterId = "11111111-1111-4111-8111-111111111111";
	const tripId = "22222222-2222-4222-8222-222222222222";
	const routeId = "33333333-3333-4333-8333-333333333333";
	const checkpointId = "44444444-4444-4444-8444-444444444444";
	const otherCheckpointId = "55555555-5555-4555-8555-555555555555";

	const tripContext: TripContextRow = {
		id: tripId,
		status: TripStatus.ONGOING,
		routeId,
		title: "Trekking Langbiang Peak",
	};

	const joinedMembers: JoinedMemberRow[] = [
		{ id: "member-1", userId: "user-1", fullName: "Camper One" },
		{ id: "member-2", userId: "user-2", fullName: "Camper Two" },
	];

	const sampleProgress: TripOperationalProgressResponseDto = {
		tripId,
		status: TripStatus.ONGOING,
		totalCheckpoints: 2,
		visitedCheckpoints: 1,
		progressPercentage: 50,
		lastVisitedCheckpoint: {
			checkpointId,
			name: "Checkpoint 1",
			arrivedAt: "2026-10-24T14:00:00.000Z",
			confirmedById: porterId,
		},
		checkpoints: [
			{
				checkpointId,
				name: "Checkpoint 1",
				type: CheckpointType.REST,
				routePosition: 0.5,
				radiusMeters: 50,
				status: "arrival_confirmed",
				arrivedAt: "2026-10-24T14:00:00.000Z",
				confirmedById: porterId,
				visitedMembersCount: 2,
				totalJoinedMembersCount: 2,
				visits: [
					{
						memberId: "member-1",
						userId: "user-1",
						displayName: "Camper One",
						arrivedAt: "2026-10-24T14:00:00.000Z",
						capturedOffline: false,
					},
					{
						memberId: "member-2",
						userId: "user-2",
						displayName: "Camper Two",
						arrivedAt: "2026-10-24T14:00:00.000Z",
						capturedOffline: false,
					},
				],
			},
			{
				checkpointId: otherCheckpointId,
				name: "Checkpoint 2",
				type: CheckpointType.FINISH,
				routePosition: 1.0,
				radiusMeters: 50,
				status: "not_visited",
				arrivedAt: null,
				confirmedById: null,
				visitedMembersCount: 0,
				totalJoinedMembersCount: 2,
				visits: [],
			},
		],
	};

	beforeEach(() => {
		repository = {
			isPorterAssignedToTrip: jest.fn().mockResolvedValue(true),
			findTripContext: jest.fn().mockResolvedValue(tripContext),
			isCheckpointOnRoute: jest.fn().mockResolvedValue(true),
			findJoinedMembersForTrip: jest.fn().mockResolvedValue(joinedMembers),
			upsertVisits: jest.fn().mockResolvedValue(undefined),
			getOperationalProgress: jest.fn().mockResolvedValue(sampleProgress),
		} as unknown as jest.Mocked<CheckpointVisitsRepository>;

		service = new CheckpointVisitsService(repository);
	});

	describe("confirmCheckpointArrival", () => {
		it("records arrival visits for joined members with authoritative time and GPS metadata", async () => {
			const dto: ConfirmCheckpointArrivalDto = {
				arrivedAt: "2026-10-24T14:00:00.000Z",
				location: { type: "Point", coordinates: [108.441, 11.941] },
				capturedOffline: false,
				syncId: "sync-event-1",
			};

			const result = await service.confirmCheckpointArrival(porterId, tripId, checkpointId, dto);

			expect(repository.isPorterAssignedToTrip).toHaveBeenCalledWith(porterId, tripId);
			expect(repository.findTripContext).toHaveBeenCalledWith(tripId);
			expect(repository.isCheckpointOnRoute).toHaveBeenCalledWith(checkpointId, routeId);
			expect(repository.findJoinedMembersForTrip).toHaveBeenCalledWith(tripId);

			expect(repository.upsertVisits).toHaveBeenCalledWith([
				{
					tripId,
					checkpointId,
					memberId: "member-1",
					confirmedById: porterId,
					arrivedAt: new Date("2026-10-24T14:00:00.000Z"),
					location: { type: "Point", coordinates: [108.441, 11.941] },
					capturedOffline: false,
					syncId: "sync-event-1",
				},
				{
					tripId,
					checkpointId,
					memberId: "member-2",
					confirmedById: porterId,
					arrivedAt: new Date("2026-10-24T14:00:00.000Z"),
					location: { type: "Point", coordinates: [108.441, 11.941] },
					capturedOffline: false,
					syncId: "sync-event-1",
				},
			]);

			expect(result).toEqual(sampleProgress);
		});

		it("rejects an unassigned Porter (BR-234)", async () => {
			repository.isPorterAssignedToTrip.mockResolvedValue(false);

			await expect(
				service.confirmCheckpointArrival(porterId, tripId, checkpointId, {})
			).rejects.toThrow(ForbiddenException);

			expect(repository.upsertVisits).not.toHaveBeenCalled();
		});

		it("rejects when Trip does not exist", async () => {
			repository.findTripContext.mockResolvedValue(null);

			await expect(
				service.confirmCheckpointArrival(porterId, tripId, checkpointId, {})
			).rejects.toThrow(NotFoundException);

			expect(repository.upsertVisits).not.toHaveBeenCalled();
		});

		it("rejects when Trip is in a non-operational status", async () => {
			repository.findTripContext.mockResolvedValue({
				...tripContext,
				status: TripStatus.DRAFT,
			});

			await expect(
				service.confirmCheckpointArrival(porterId, tripId, checkpointId, {})
			).rejects.toThrow(BadRequestException);

			expect(repository.upsertVisits).not.toHaveBeenCalled();
		});

		it("rejects when Checkpoint does not belong to the Trip Route (BR-234)", async () => {
			repository.isCheckpointOnRoute.mockResolvedValue(false);

			await expect(
				service.confirmCheckpointArrival(porterId, tripId, checkpointId, {})
			).rejects.toThrow(BadRequestException);

			expect(repository.upsertVisits).not.toHaveBeenCalled();
		});

		it("allows arrival without GPS metadata without fabricating coordinates", async () => {
			const dto: ConfirmCheckpointArrivalDto = {
				arrivedAt: "2026-10-24T14:00:00.000Z",
				location: null,
			};

			await service.confirmCheckpointArrival(porterId, tripId, checkpointId, dto);

			expect(repository.upsertVisits).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						location: null,
					}),
				])
			);
		});

		it("filters visit records to specified member IDs when subset provided", async () => {
			const dto: ConfirmCheckpointArrivalDto = {
				memberIds: ["member-1"],
			};

			await service.confirmCheckpointArrival(porterId, tripId, checkpointId, dto);

			const callArgs = repository.upsertVisits.mock.calls[0][0] as UpsertCheckpointVisitItem[];
			expect(callArgs).toHaveLength(1);
			expect(callArgs[0].memberId).toBe("member-1");
		});
	});

	describe("syncCheckpointArrivals", () => {
		it("synchronizes offline arrival events idempotently", async () => {
			const dto: SyncCheckpointArrivalsDto = {
				arrivals: [
					{
						checkpointId,
						arrivedAt: "2026-10-24T13:00:00.000Z",
						capturedOffline: true,
						syncId: "offline-1",
					},
					{
						checkpointId: otherCheckpointId,
						arrivedAt: "2026-10-24T15:00:00.000Z",
						capturedOffline: true,
						syncId: "offline-2",
					},
				],
			};

			const result = await service.syncCheckpointArrivals(porterId, tripId, dto);

			expect(repository.upsertVisits).toHaveBeenCalledTimes(2);
			expect(result).toEqual(sampleProgress);
		});
	});

	describe("getTripOperationalProgress", () => {
		it("returns authoritative progress projection", async () => {
			const result = await service.getTripOperationalProgress(tripId);
			expect(result).toEqual(sampleProgress);
			expect(repository.getOperationalProgress).toHaveBeenCalledWith(tripId);
		});

		it("throws NotFoundException when progress cannot be found", async () => {
			repository.getOperationalProgress.mockResolvedValue(null);
			await expect(service.getTripOperationalProgress(tripId)).rejects.toThrow(NotFoundException);
		});
	});
});
