import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import { RouteReviewOutcome } from "../dto/list-route-reviews-query.dto";
import { ReviewTrekkingRouteAction } from "../dto/review-trekking-route.dto";
import { TrekkingRouteDifficulty, TrekkingRouteStatus } from "../entities/trekking-route.entity";
import type { TrekkingRoutesRepository } from "../repositories/trekking-routes.repository";
import { TrekkingRoutesService } from "./trekking-routes.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const ROUTE_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_HOST_ID = "44444444-4444-4444-8444-444444444444";
const ADMIN_ID = "55555555-5555-4555-8555-555555555555";

function createDto() {
	return {
		name: "Pine Ridge Trail",
		description: "Ridge route",
		geometry: {
			type: "LineString" as const,
			coordinates: [[108.441, 11.941] as [number, number], [108.449, 11.946] as [number, number]],
		},
		difficulty: TrekkingRouteDifficulty.MODERATE,
		expectedDurationMinutes: 120,
	};
}

function createdRoute(status = TrekkingRouteStatus.DRAFT) {
	return {
		id: ROUTE_ID,
		...createDto(),
		hostId: HOST_ID,
		description: "Ridge route",
		lengthMeters: 1024.5,
		status,
		createdAt: new Date("2026-08-24T00:00:00.000Z"),
		updatedAt: new Date("2026-08-24T00:00:00.000Z"),
	};
}

function actor(userId: string, roles: UserRole[]): AuthenticatedUser {
	return { userId, roles, status: UserStatus.ACTIVE };
}

function reviewRoute(status = TrekkingRouteStatus.PENDING_APPROVAL) {
	return {
		...createdRoute(),
		status,
		checkpoints: [],
		dangerZones: [],
	};
}

describe("TrekkingRoutesService", () => {
	let routeRepository: {
		createDraft: jest.Mock;
		updateDraft: jest.Mock;
		hasTripReferences: jest.Mock;
		findByHost: jest.Mock;
		findByHostPaginated: jest.Mock;
		findRouteById: jest.Mock;
		findOneForLifecycleUpdate: jest.Mock;
		findPendingReview: jest.Mock;
		findAdminReviews: jest.Mock;
		findReviewRouteByIdForUpdate: jest.Mock;
		validateApprovalIntegrity: jest.Mock;
		updateStatus: jest.Mock;
	};
	let auditRepository: { save: jest.Mock };
	let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
	let service: TrekkingRoutesService;

	beforeEach(() => {
		routeRepository = {
			createDraft: jest.fn().mockResolvedValue(createdRoute()),
			updateDraft: jest.fn().mockResolvedValue(createdRoute()),
			hasTripReferences: jest.fn().mockResolvedValue(false),
			findByHost: jest.fn().mockResolvedValue([createdRoute()]),
			findByHostPaginated: jest.fn().mockResolvedValue({ items: [createdRoute()], total: 41 }),
			findRouteById: jest.fn().mockResolvedValue(createdRoute()),
			findOneForLifecycleUpdate: jest.fn().mockResolvedValue({
				route: createdRoute(TrekkingRouteStatus.ACTIVE),
				hostId: HOST_ID,
				integrityValid: true,
			}),
			findPendingReview: jest.fn().mockResolvedValue([reviewRoute()]),
			findAdminReviews: jest.fn().mockResolvedValue({ items: [reviewRoute()], total: 41 }),
			findReviewRouteByIdForUpdate: jest.fn().mockResolvedValue(reviewRoute()),
			validateApprovalIntegrity: jest.fn().mockResolvedValue({
				geometryValid: true,
				difficultyValid: true,
			}),
			updateStatus: jest.fn((_routeId: string, status: TrekkingRouteStatus) =>
				Promise.resolve(createdRoute(status))
			),
		};
		auditRepository = { save: jest.fn().mockResolvedValue({}) };
		dataSource = {
			getRepository: jest.fn().mockReturnValue(auditRepository),
			transaction: jest.fn(async (callback: (manager: unknown) => unknown) =>
				callback({
					getRepository: jest.fn().mockReturnValue(auditRepository),
					withRepository: jest.fn().mockReturnValue(routeRepository),
				})
			),
		};
		service = new TrekkingRoutesService(
			routeRepository as unknown as TrekkingRoutesRepository,
			dataSource as never
		);
	});

	describe("updateDraft", () => {
		beforeEach(() => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue({
				route: createdRoute(),
				hostId: HOST_ID,
				integrityValid: true,
			});
		});
		it("updates an owned draft without changing its lifecycle and audits the result", async () => {
			await expect(service.updateDraft(HOST_ID, ROUTE_ID, createDto())).resolves.toEqual(
				createdRoute()
			);
			expect(routeRepository.updateDraft).toHaveBeenCalledWith(ROUTE_ID, {
				...createDto(),
				hostId: HOST_ID,
			});
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "trekking_route.updated",
					before: expect.objectContaining({ status: "draft" }),
					after: expect.objectContaining({ status: "draft" }),
				})
			);
		});
		it("rejects a different Host before writing", async () => {
			await expect(service.updateDraft(OTHER_HOST_ID, ROUTE_ID, createDto())).rejects.toMatchObject(
				{ status: 403 }
			);
			expect(routeRepository.updateDraft).not.toHaveBeenCalled();
		});
		it.each([
			TrekkingRouteStatus.PENDING_APPROVAL,
			TrekkingRouteStatus.ACTIVE,
			TrekkingRouteStatus.CLOSED,
		])("rejects %s", async (status) => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue({
				route: createdRoute(status),
				hostId: HOST_ID,
			});
			await expect(service.updateDraft(HOST_ID, ROUTE_ID, createDto())).rejects.toMatchObject({
				status: 409,
			});
			expect(routeRepository.updateDraft).not.toHaveBeenCalled();
		});
		it("protects a previously published draft referenced by a Trip", async () => {
			routeRepository.hasTripReferences.mockResolvedValue(true);
			await expect(service.updateDraft(HOST_ID, ROUTE_ID, createDto())).rejects.toMatchObject({
				status: 409,
			});
			expect(routeRepository.updateDraft).not.toHaveBeenCalled();
		});
		it("returns 404 for a missing route", async () => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue(null);
			await expect(service.updateDraft(HOST_ID, ROUTE_ID, createDto())).rejects.toMatchObject({
				status: 404,
			});
		});
		it("propagates validation and audit failures through the transaction", async () => {
			routeRepository.updateDraft.mockRejectedValueOnce(new Error("route update failed"));
			await expect(service.updateDraft(HOST_ID, ROUTE_ID, createDto())).rejects.toThrow(
				"route update failed"
			);
			expect(auditRepository.save).not.toHaveBeenCalled();
			auditRepository.save.mockRejectedValueOnce(new Error("audit unavailable"));
			await expect(service.updateDraft(HOST_ID, ROUTE_ID, createDto())).rejects.toThrow(
				"audit unavailable"
			);
		});
	});

	describe("listByHost", () => {
		it("returns only routes from the current Host", async () => {
			const routes = await service.listByHost(HOST_ID);

			expect(routeRepository.findByHost).toHaveBeenCalledWith(HOST_ID);
			expect(routes).toEqual([createdRoute()]);
		});
	});

	describe("getOwnedById", () => {
		it("returns the selected Route to its owning Host", async () => {
			await expect(service.getOwnedById(HOST_ID, ROUTE_ID)).resolves.toEqual(createdRoute());
			expect(routeRepository.findRouteById).toHaveBeenCalledWith(ROUTE_ID);
		});

		it("returns 404 when the Route does not exist", async () => {
			routeRepository.findRouteById.mockResolvedValue(null);
			await expect(service.getOwnedById(HOST_ID, ROUTE_ID)).rejects.toMatchObject({ status: 404 });
		});

		it("returns 403 when another Host owns the Route", async () => {
			await expect(service.getOwnedById(OTHER_HOST_ID, ROUTE_ID)).rejects.toMatchObject({
				status: 403,
			});
		});
	});

	describe("listByHostPaginated", () => {
		it.each([
			[1, 20, 3],
			[2, 20, 3],
			[3, 20, 3],
		] as const)("returns metadata for page %i", async (page, limit, totalPages) => {
			const result = await service.listByHostPaginated(HOST_ID, {
				page,
				limit,
				status: "all",
			});

			expect(routeRepository.findByHostPaginated).toHaveBeenCalledWith(
				HOST_ID,
				page,
				limit,
				null,
				"",
				"newest"
			);
			expect(result).toEqual({
				items: [createdRoute()],
				pagination: { page, limit, total: 41, totalPages },
			});
		});

		it("returns empty pagination metadata without changing Host scope", async () => {
			routeRepository.findByHostPaginated.mockResolvedValueOnce({ items: [], total: 0 });

			await expect(
				service.listByHostPaginated(HOST_ID, { page: 1, limit: 20, status: "active" })
			).resolves.toEqual({
				items: [],
				pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			});
			expect(routeRepository.findByHostPaginated).toHaveBeenCalledWith(
				HOST_ID,
				1,
				20,
				TrekkingRouteStatus.ACTIVE,
				"",
				"newest"
			);
		});

		it.each([
			["draft", TrekkingRouteStatus.DRAFT],
			["pending_approval", TrekkingRouteStatus.PENDING_APPROVAL],
			["active", TrekkingRouteStatus.ACTIVE],
			["closed", TrekkingRouteStatus.CLOSED],
			["all", null],
		] as const)(
			"forwards status filter %s to the repository as %s",
			async (statusFilter, expectedStatus) => {
				await service.listByHostPaginated(HOST_ID, {
					page: 2,
					limit: 15,
					status: statusFilter,
				});

				expect(routeRepository.findByHostPaginated).toHaveBeenCalledWith(
					HOST_ID,
					2,
					15,
					expectedStatus,
					"",
					"newest"
				);
			}
		);
	});

	describe("Host submission for approval", () => {
		beforeEach(() => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue({
				route: createdRoute(TrekkingRouteStatus.DRAFT),
				hostId: HOST_ID,
				integrityValid: true,
			});
		});

		it("submits a prepared owned draft Route and audits the transition", async () => {
			const result = await service.submitForApproval(HOST_ID, ROUTE_ID);

			expect(routeRepository.findOneForLifecycleUpdate).toHaveBeenCalledWith(ROUTE_ID);
			expect(routeRepository.updateStatus).toHaveBeenCalledWith(
				ROUTE_ID,
				TrekkingRouteStatus.PENDING_APPROVAL
			);
			expect(auditRepository.save).toHaveBeenCalledWith({
				actorId: HOST_ID,
				action: "trekking_route.submitted_for_approval",
				targetType: "trekking_route",
				targetId: ROUTE_ID,
				before: { status: TrekkingRouteStatus.DRAFT },
				after: { status: TrekkingRouteStatus.PENDING_APPROVAL },
				reason: "host_submit_trekking_route_for_approval",
			});
			expect(result.status).toBe(TrekkingRouteStatus.PENDING_APPROVAL);
		});

		it("returns 404 for a missing Route without side effects", async () => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue(null);

			await expect(service.submitForApproval(HOST_ID, ROUTE_ID)).rejects.toMatchObject({
				status: 404,
			});
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it("returns 403 for a foreign Host without side effects", async () => {
			await expect(service.submitForApproval(OTHER_HOST_ID, ROUTE_ID)).rejects.toMatchObject({
				status: 403,
			});
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it.each([
			TrekkingRouteStatus.PENDING_APPROVAL,
			TrekkingRouteStatus.ACTIVE,
			TrekkingRouteStatus.CLOSED,
		])("returns 409 for source state %s without side effects", async (status) => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue({
				route: createdRoute(status),
				hostId: HOST_ID,
				integrityValid: true,
			});

			await expect(service.submitForApproval(HOST_ID, ROUTE_ID)).rejects.toMatchObject({
				status: 409,
			});
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it("returns 422 when the authoritative stored Route is invalid", async () => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue({
				route: createdRoute(TrekkingRouteStatus.DRAFT),
				hostId: HOST_ID,
				integrityValid: false,
			});

			await expect(service.submitForApproval(HOST_ID, ROUTE_ID)).rejects.toMatchObject({
				status: 422,
			});
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
		});

		it("propagates audit failure so the transaction can roll back the status", async () => {
			auditRepository.save.mockRejectedValue(new Error("audit unavailable"));

			await expect(service.submitForApproval(HOST_ID, ROUTE_ID)).rejects.toThrow(
				"audit unavailable"
			);
			expect(routeRepository.updateStatus).toHaveBeenCalledWith(
				ROUTE_ID,
				TrekkingRouteStatus.PENDING_APPROVAL
			);
		});
	});

	describe("Admin review", () => {
		it("returns the requested review outcome with accurate pagination", async () => {
			await expect(
				service.listAdminReviews({
					reviewOutcome: RouteReviewOutcome.APPROVED,
					page: 2,
					limit: 20,
				})
			).resolves.toEqual({
				items: [reviewRoute()],
				pagination: { page: 2, limit: 20, total: 41, totalPages: 3 },
			});
			expect(routeRepository.findAdminReviews).toHaveBeenCalledWith(
				RouteReviewOutcome.APPROVED,
				2,
				20
			);
		});

		it("lists only repository-provided pending review Routes", async () => {
			await expect(service.listPendingReview()).resolves.toEqual([reviewRoute()]);
			expect(routeRepository.findPendingReview).toHaveBeenCalledTimes(1);
		});

		it("approves a valid pending Route and audits the status transition", async () => {
			const result = await service.review(HOST_ID, ROUTE_ID, {
				action: ReviewTrekkingRouteAction.APPROVE,
			});

			expect(routeRepository.findReviewRouteByIdForUpdate).toHaveBeenCalledWith(ROUTE_ID);
			expect(routeRepository.validateApprovalIntegrity).toHaveBeenCalledWith(ROUTE_ID);
			expect(routeRepository.updateStatus).toHaveBeenCalledWith(
				ROUTE_ID,
				TrekkingRouteStatus.ACTIVE
			);
			expect(result.status).toBe(TrekkingRouteStatus.ACTIVE);
			expect(auditRepository.save).toHaveBeenCalledWith({
				actorId: HOST_ID,
				action: "trekking_route.approved",
				targetType: "trekking_route",
				targetId: ROUTE_ID,
				before: { status: TrekkingRouteStatus.PENDING_APPROVAL },
				after: { status: TrekkingRouteStatus.ACTIVE },
				reason: null,
			});
		});

		it("returns a declined Route to draft and audits the reason", async () => {
			await service.review(HOST_ID, ROUTE_ID, {
				action: ReviewTrekkingRouteAction.DECLINE,
				reason: "Unsafe terrain",
			});

			expect(routeRepository.validateApprovalIntegrity).not.toHaveBeenCalled();
			expect(routeRepository.updateStatus).toHaveBeenCalledWith(
				ROUTE_ID,
				TrekkingRouteStatus.DRAFT
			);
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "trekking_route.declined",
					before: { status: TrekkingRouteStatus.PENDING_APPROVAL },
					after: { status: TrekkingRouteStatus.DRAFT },
					reason: "Unsafe terrain",
				})
			);
		});

		it("returns 404 without mutation when the Route is missing", async () => {
			routeRepository.findReviewRouteByIdForUpdate.mockResolvedValue(null);

			await expect(
				service.review(HOST_ID, ROUTE_ID, { action: ReviewTrekkingRouteAction.APPROVE })
			).rejects.toMatchObject({ status: 404 });
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it.each([TrekkingRouteStatus.DRAFT, TrekkingRouteStatus.ACTIVE, TrekkingRouteStatus.CLOSED])(
			"returns 409 for stale source state %s without side effects",
			async (status) => {
				routeRepository.findReviewRouteByIdForUpdate.mockResolvedValue(reviewRoute(status));
				await expect(
					service.review(HOST_ID, ROUTE_ID, { action: ReviewTrekkingRouteAction.APPROVE })
				).rejects.toMatchObject({ status: 409 });
				expect(routeRepository.updateStatus).not.toHaveBeenCalled();
				expect(auditRepository.save).not.toHaveBeenCalled();
			}
		);

		it.each(["geometryValid", "difficultyValid"] as const)(
			"returns 422 and does not mutate when %s is false",
			async (invalidField) => {
				routeRepository.validateApprovalIntegrity.mockResolvedValue({
					geometryValid: true,
					difficultyValid: true,
					[invalidField]: false,
				});

				await expect(
					service.review(HOST_ID, ROUTE_ID, { action: ReviewTrekkingRouteAction.APPROVE })
				).rejects.toMatchObject({ status: 422 });
				expect(routeRepository.updateStatus).not.toHaveBeenCalled();
				expect(auditRepository.save).not.toHaveBeenCalled();
			}
		);

		it("propagates audit failure so the review transaction rolls back", async () => {
			auditRepository.save.mockRejectedValue(new Error("audit unavailable"));

			await expect(
				service.review(HOST_ID, ROUTE_ID, { action: ReviewTrekkingRouteAction.APPROVE })
			).rejects.toThrow("audit unavailable");
			expect(routeRepository.updateStatus).toHaveBeenCalledTimes(1);
		});
	});

	it("creates a draft route for the current Host and writes a summarized audit", async () => {
		const route = await service.create(HOST_ID, createDto());

		expect(routeRepository.createDraft).toHaveBeenCalledWith(
			expect.objectContaining({ hostId: HOST_ID, name: "Pine Ridge Trail" })
		);
		expect(route.status).toBe(TrekkingRouteStatus.DRAFT);
		expect(auditRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: HOST_ID,
				action: "trekking_route.created",
				targetType: "trekking_route",
				targetId: ROUTE_ID,
				before: null,
				reason: "host_create_trekking_route",
				after: expect.objectContaining({
					status: TrekkingRouteStatus.DRAFT,
					geometry: {
						type: "LineString",
						vertexCount: 2,
						start: [108.441, 11.941],
						end: [108.449, 11.946],
						lengthMeters: 1024.5,
						boundingBox: [108.441, 11.941, 108.449, 11.946],
					},
				}),
			})
		);
	});

	it("propagates audit failure so the transaction can roll back route creation", async () => {
		auditRepository.save.mockRejectedValue(new Error("audit unavailable"));

		await expect(service.create(HOST_ID, createDto())).rejects.toThrow("audit unavailable");
		expect(routeRepository.createDraft).toHaveBeenCalledTimes(1);
	});

	describe("close", () => {
		it("locks and closes an active owned route with the required audit", async () => {
			const result = await service.close(actor(HOST_ID, [UserRole.HOST]), ROUTE_ID, {
				reason: "Unsafe trail conditions",
			});

			expect(routeRepository.findOneForLifecycleUpdate).toHaveBeenCalledWith(ROUTE_ID);
			expect(routeRepository.updateStatus).toHaveBeenCalledWith(
				ROUTE_ID,
				TrekkingRouteStatus.CLOSED
			);
			expect(auditRepository.save).toHaveBeenCalledWith({
				actorId: HOST_ID,
				action: "trekking_route.closed",
				targetType: "trekking_route",
				targetId: ROUTE_ID,
				before: { status: TrekkingRouteStatus.ACTIVE },
				after: { status: TrekkingRouteStatus.CLOSED },
				reason: "Unsafe trail conditions",
			});
			expect(result.status).toBe(TrekkingRouteStatus.CLOSED);
		});

		it("allows an explicitly authorized Admin to close a foreign route", async () => {
			const result = await service.close(actor(ADMIN_ID, [UserRole.ADMIN]), ROUTE_ID, {
				reason: "Administrative safety closure",
			});

			expect(result.status).toBe(TrekkingRouteStatus.CLOSED);
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({ actorId: ADMIN_ID })
			);
		});

		it.each([
			[TrekkingRouteStatus.DRAFT],
			[TrekkingRouteStatus.PENDING_APPROVAL],
			[TrekkingRouteStatus.CLOSED],
		])("rejects close from %s with no write or audit", async (status) => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue({
				route: createdRoute(status),
				hostId: HOST_ID,
				integrityValid: true,
			});

			await expect(
				service.close(actor(HOST_ID, [UserRole.HOST]), ROUTE_ID, { reason: "Reason" })
			).rejects.toMatchObject({ status: 409 });
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it("rejects a foreign Host, Camper, and Porter with no side effects", async () => {
			await expect(
				service.close(actor(OTHER_HOST_ID, [UserRole.HOST]), ROUTE_ID, { reason: "Reason" })
			).rejects.toMatchObject({ status: 403 });
			await expect(
				service.close(actor(OTHER_HOST_ID, [UserRole.CAMPER]), ROUTE_ID, { reason: "Reason" })
			).rejects.toMatchObject({ status: 403 });
			await expect(
				service.close(actor(OTHER_HOST_ID, [UserRole.PORTER]), ROUTE_ID, { reason: "Reason" })
			).rejects.toMatchObject({ status: 403 });
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it("returns 404 for a missing route with no side effects", async () => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue(null);

			await expect(
				service.close(actor(HOST_ID, [UserRole.HOST]), ROUTE_ID, { reason: "Reason" })
			).rejects.toMatchObject({ status: 404 });
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});
	});

	describe("reopen", () => {
		beforeEach(() => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue({
				route: createdRoute(TrekkingRouteStatus.CLOSED),
				hostId: HOST_ID,
				integrityValid: true,
			});
		});

		it("validates and reopens a closed route into pending approval", async () => {
			const result = await service.reopen(actor(HOST_ID, [UserRole.HOST]), ROUTE_ID, {
				reason: "Conditions are safe again",
			});

			expect(routeRepository.findOneForLifecycleUpdate).toHaveBeenCalledWith(ROUTE_ID);
			expect(routeRepository.updateStatus).toHaveBeenCalledWith(
				ROUTE_ID,
				TrekkingRouteStatus.PENDING_APPROVAL
			);
			expect(auditRepository.save).toHaveBeenCalledWith({
				actorId: HOST_ID,
				action: "trekking_route.reopened",
				targetType: "trekking_route",
				targetId: ROUTE_ID,
				before: { status: TrekkingRouteStatus.CLOSED },
				after: { status: TrekkingRouteStatus.PENDING_APPROVAL },
				reason: "Conditions are safe again",
			});
			expect(result.status).toBe(TrekkingRouteStatus.PENDING_APPROVAL);
		});

		it("allows an explicitly authorized Admin to reopen a foreign route", async () => {
			const result = await service.reopen(actor(ADMIN_ID, [UserRole.ADMIN]), ROUTE_ID, {
				reason: "Administrative review is required",
			});

			expect(routeRepository.updateStatus).toHaveBeenCalledWith(
				ROUTE_ID,
				TrekkingRouteStatus.PENDING_APPROVAL
			);
			expect(auditRepository.save).toHaveBeenCalledWith({
				actorId: ADMIN_ID,
				action: "trekking_route.reopened",
				targetType: "trekking_route",
				targetId: ROUTE_ID,
				before: { status: TrekkingRouteStatus.CLOSED },
				after: { status: TrekkingRouteStatus.PENDING_APPROVAL },
				reason: "Administrative review is required",
			});
			expect(result.status).toBe(TrekkingRouteStatus.PENDING_APPROVAL);
		});

		it.each([
			TrekkingRouteStatus.ACTIVE,
			TrekkingRouteStatus.DRAFT,
			TrekkingRouteStatus.PENDING_APPROVAL,
		])("rejects reopen from %s with no side effects", async (status) => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue({
				route: createdRoute(status),
				hostId: HOST_ID,
				integrityValid: true,
			});

			await expect(
				service.reopen(actor(HOST_ID, [UserRole.HOST]), ROUTE_ID, { reason: "Reason" })
			).rejects.toMatchObject({ status: 409 });
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it("rejects a closed route whose canonical data is no longer valid", async () => {
			routeRepository.findOneForLifecycleUpdate.mockResolvedValue({
				route: createdRoute(TrekkingRouteStatus.CLOSED),
				hostId: HOST_ID,
				integrityValid: false,
			});

			await expect(
				service.reopen(actor(HOST_ID, [UserRole.HOST]), ROUTE_ID, { reason: "Reason" })
			).rejects.toMatchObject({ status: 409 });
			expect(routeRepository.updateStatus).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});
	});

	it("propagates lifecycle audit failure so the transaction can roll back the status update", async () => {
		auditRepository.save.mockRejectedValue(new Error("audit unavailable"));

		await expect(
			service.close(actor(HOST_ID, [UserRole.HOST]), ROUTE_ID, { reason: "Reason" })
		).rejects.toThrow("audit unavailable");
		expect(routeRepository.updateStatus).toHaveBeenCalledTimes(1);
	});
});
