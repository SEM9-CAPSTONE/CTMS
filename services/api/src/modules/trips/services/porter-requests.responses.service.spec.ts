import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { DataSource, EntityManager } from "typeorm";
import { TripPorterStatus } from "../../profiles/entities/trip-porter.entity";
import type { EventsGateway } from "../../realtime/events.gateway";
import { IntendedPorterRole } from "../dto/available-porters-query.dto";
import { PorterRequest, PorterRequestStatus } from "../entities/porter-request.entity";
import { TripStatus } from "../entities/trip.entity";
import type { PorterRequestsRepository } from "../repositories/porter-requests.repository";
import type { TripsRepository } from "../repositories/trips.repository";
import { PorterRequestsService } from "./porter-requests.service";

const NOW = new Date("2035-01-01T00:00:00Z");
const DEADLINE = new Date("2035-01-02T00:00:00Z");

function createHarness() {
	const state = {
		request: Object.assign(new PorterRequest(), {
			id: "request",
			tripId: "trip",
			porterId: "porter",
			requestedBy: "host",
			requestedRole: IntendedPorterRole.LEAD,
			note: null,
			status: PorterRequestStatus.PENDING,
			expiresAt: DEADLINE,
			respondedAt: null,
			createdAt: NOW,
			updatedAt: NOW,
		}) as PorterRequest | null,
		now: NOW,
		trip: {
			id: "trip",
			title: "Trip",
			routeId: "route",
			status: TripStatus.PUBLISHED,
			startsAt: new Date("2035-01-03T00:00:00Z"),
			endsAt: new Date("2035-01-03T08:00:00Z"),
			meetingAt: null,
		},
		eligible: true,
		conflicting: false,
		activeAssignment: false,
		assignment: null as { tripId: string; porterId: string; status: TripPorterStatus } | null,
	};
	const order: string[] = [];
	const repository = {
		findByIdForUpdate: jest.fn(async () => {
			order.push("request-lock");
			return state.request;
		}),
		findByIdWithContext: jest.fn(async () => ({ ...state.request, assignment: state.assignment })),
		hasActiveAssignmentForTrip: jest.fn(async () => state.activeAssignment),
		markStatus: jest.fn(async (_id: string, status: PorterRequestStatus, respondedAt: Date) => {
			order.push("transition");
			if (!state.request) throw new Error("Missing request");
			state.request.status = status;
			state.request.respondedAt = respondedAt;
			return state.request;
		}),
		createAssignedTripPorterIdempotent: jest.fn(async () => {
			order.push("assignment");
			state.assignment = { tripId: "trip", porterId: "porter", status: TripPorterStatus.ASSIGNED };
			return state.assignment;
		}),
		expirePendingBatch: jest.fn().mockResolvedValue([]),
		expirePendingByPorter: jest.fn().mockResolvedValue([]),
		listForPorter: jest.fn().mockResolvedValue([]),
	};
	const manager = {
		withRepository: jest.fn(() => repository),
		query: jest.fn(async (sql: string) => {
			if (sql.includes("pg_advisory_xact_lock")) {
				order.push("porter-lock");
				return [];
			}
			if (sql.includes('FROM "trips"')) {
				order.push("trip-lock");
				return [state.trip];
			}
			if (sql.includes("clock_timestamp()")) {
				order.push("clock");
				return [{ now: state.now }];
			}
			if (sql.includes('FROM "trip_porters"')) return state.conflicting ? [{ value: 1 }] : [];
			if (sql.includes('FROM "porter_profiles"')) return state.eligible ? [{ value: 1 }] : [];
			throw new Error(`Unexpected query: ${sql}`);
		}),
	};
	const dataSource = {
		transaction: jest.fn(async (work: (manager: EntityManager) => Promise<unknown>) => {
			const value = await work(manager as unknown as EntityManager);
			order.push("commit");
			return value;
		}),
	};
	const gateway = {
		emitPorterRequestStateChanged: jest.fn(() => {
			order.push("notify");
		}),
	};
	const service = new PorterRequestsService(
		dataSource as unknown as DataSource,
		{} as TripsRepository,
		repository as unknown as PorterRequestsRepository,
		{} as ConfigService,
		gateway as unknown as EventsGateway
	);
	return { state, repository, manager, gateway, service, order };
}

describe("Porter Request responses", () => {
	it("locks the Porter before checking eligibility and commits Assignment + ACCEPTED before notifying", async () => {
		const h = createHarness();
		const result = await h.service.accept("porter", "request");
		expect(result.status).toBe(PorterRequestStatus.ACCEPTED);
		expect(result.assignment?.status).toBe(TripPorterStatus.ASSIGNED);
		expect(h.manager.query).toHaveBeenCalledWith(expect.stringContaining("pg_advisory_xact_lock"), [
			"porter-assignment:porter",
		]);
		expect(h.order.indexOf("porter-lock")).toBeLessThan(h.order.indexOf("request-lock"));
		expect(h.order.indexOf("trip-lock")).toBeLessThan(h.order.indexOf("clock"));
		expect(h.order.slice(-4)).toEqual(["assignment", "transition", "commit", "notify"]);
	});

	it.each(["accept", "decline"] as const)(
		"rejects %s by another Porter without changing the request",
		async (action) => {
			const h = createHarness();
			await expect(h.service[action]("other", "request")).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(h.repository.markStatus).not.toHaveBeenCalled();
			expect(h.repository.createAssignedTripPorterIdempotent).not.toHaveBeenCalled();
		}
	);
	it.each(["accept", "decline"] as const)("rejects %s of a missing request", async (action) => {
		const h = createHarness();
		h.state.request = null;
		await expect(h.service[action]("porter", "missing")).rejects.toBeInstanceOf(NotFoundException);
	});
	it.each(["eligible", "conflicting", "activeAssignment"] as const)(
		"revalidates %s before accepting",
		async (condition) => {
			const h = createHarness();
			h.state[condition] = condition !== "eligible";
			await expect(h.service.accept("porter", "request")).rejects.toBeInstanceOf(ConflictException);
			expect(h.repository.markStatus).not.toHaveBeenCalled();
			expect(h.repository.createAssignedTripPorterIdempotent).not.toHaveBeenCalled();
		}
	);
	it.each([TripStatus.CANCELLED, TripStatus.ONGOING, TripStatus.COMPLETED, TripStatus.DRAFT])(
		"rejects accepting a %s Trip",
		async (status) => {
			const h = createHarness();
			h.state.trip.status = status;
			await expect(h.service.accept("porter", "request")).rejects.toBeInstanceOf(ConflictException);
			expect(h.repository.createAssignedTripPorterIdempotent).not.toHaveBeenCalled();
		}
	);
	it.each(["accept", "decline"] as const)(
		"expires %s at the exact deadline instead of applying the response",
		async (action) => {
			const h = createHarness();
			h.state.now = DEADLINE;
			expect((await h.service[action]("porter", "request")).status).toBe(
				PorterRequestStatus.EXPIRED
			);
			expect(h.repository.createAssignedTripPorterIdempotent).not.toHaveBeenCalled();
			expect(h.gateway.emitPorterRequestStateChanged).toHaveBeenCalledTimes(1);
		}
	);
	it("checks current database time after waiting for the request lock", async () => {
		const h = createHarness();
		h.repository.findByIdForUpdate.mockImplementation(async () => {
			h.state.now = DEADLINE;
			return h.state.request;
		});
		expect((await h.service.accept("porter", "request")).status).toBe(PorterRequestStatus.EXPIRED);
		expect(h.repository.createAssignedTripPorterIdempotent).not.toHaveBeenCalled();
	});
	it("rechecks expiry after eligibility queries", async () => {
		const h = createHarness();
		h.repository.hasActiveAssignmentForTrip.mockImplementation(async () => {
			h.state.now = DEADLINE;
			return false;
		});
		expect((await h.service.accept("porter", "request")).status).toBe(PorterRequestStatus.EXPIRED);
		expect(h.repository.createAssignedTripPorterIdempotent).not.toHaveBeenCalled();
	});
	it("does not mark ACCEPTED or notify when Assignment creation fails", async () => {
		const h = createHarness();
		h.repository.createAssignedTripPorterIdempotent.mockRejectedValueOnce(
			new Error("Assignment failed")
		);
		await expect(h.service.accept("porter", "request")).rejects.toThrow("Assignment failed");
		expect(h.repository.markStatus).not.toHaveBeenCalled();
		expect(h.gateway.emitPorterRequestStateChanged).not.toHaveBeenCalled();
	});
	it("keeps an accepted response successful if its post-commit notification fails", async () => {
		const h = createHarness();
		h.gateway.emitPorterRequestStateChanged.mockImplementationOnce(() => {
			throw new Error("socket offline");
		});
		const result = await h.service.accept("porter", "request");
		expect(result.status).toBe(PorterRequestStatus.ACCEPTED);
		expect(result.assignment?.status).toBe(TripPorterStatus.ASSIGNED);
		expect(h.order).toContain("commit");
	});
	it("retries ACCEPTED idempotently even after its Assignment is unassigned", async () => {
		const h = createHarness();
		await h.service.accept("porter", "request");
		if (h.state.assignment) h.state.assignment.status = TripPorterStatus.UNASSIGNED;
		const result = await h.service.accept("porter", "request");
		expect(result.status).toBe(PorterRequestStatus.ACCEPTED);
		expect(result.assignment?.status).toBe(TripPorterStatus.UNASSIGNED);
		expect(h.repository.createAssignedTripPorterIdempotent).toHaveBeenCalledTimes(1);
		expect(h.gateway.emitPorterRequestStateChanged).toHaveBeenCalledTimes(1);
	});
	it("declines and retries without creating Assignments or duplicate notifications", async () => {
		const h = createHarness();
		await h.service.decline("porter", "request");
		await h.service.decline("porter", "request");
		expect(h.state.request?.status).toBe(PorterRequestStatus.DECLINED);
		expect(h.repository.createAssignedTripPorterIdempotent).not.toHaveBeenCalled();
		expect(h.gateway.emitPorterRequestStateChanged).toHaveBeenCalledTimes(1);
	});
	it("authorizes Host cancellation and makes repeated cancellation idempotent", async () => {
		const h = createHarness();
		await expect(h.service.cancel("other", "trip", "request")).rejects.toBeInstanceOf(
			ForbiddenException
		);
		await expect(h.service.cancel("host", "other-trip", "request")).rejects.toBeInstanceOf(
			ForbiddenException
		);
		await h.service.cancel("host", "trip", "request");
		await h.service.cancel("host", "trip", "request");
		expect(h.state.request?.status).toBe(PorterRequestStatus.CANCELLED);
		expect(h.gateway.emitPorterRequestStateChanged).toHaveBeenCalledTimes(1);
	});
	it.each([
		PorterRequestStatus.DECLINED,
		PorterRequestStatus.CANCELLED,
		PorterRequestStatus.EXPIRED,
	])("cannot accept a terminal %s request", async (status) => {
		const h = createHarness();
		if (h.state.request) h.state.request.status = status;
		await expect(h.service.accept("porter", "request")).rejects.toBeInstanceOf(ConflictException);
		expect(h.repository.markStatus).not.toHaveBeenCalled();
	});
	it("cannot decline an accepted request or cancel a declined one", async () => {
		const h = createHarness();
		await h.service.accept("porter", "request");
		await expect(h.service.decline("porter", "request")).rejects.toBeInstanceOf(ConflictException);
		const other = createHarness();
		await other.service.decline("porter", "request");
		await expect(other.service.cancel("host", "trip", "request")).rejects.toBeInstanceOf(
			ConflictException
		);
	});
	it("notifies only expired rows returned by the atomic batch", async () => {
		const h = createHarness();
		h.repository.expirePendingBatch.mockResolvedValueOnce([
			{ ...h.state.request, status: PorterRequestStatus.EXPIRED },
		]);
		expect(await h.service.expirePending(10)).toBe(1);
		expect(await h.service.expirePending(10)).toBe(0);
		expect(h.gateway.emitPorterRequestStateChanged).toHaveBeenCalledTimes(1);
	});
});
