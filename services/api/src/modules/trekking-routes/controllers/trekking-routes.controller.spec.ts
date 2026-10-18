import { ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import { RouteReviewOutcome } from "../dto/list-route-reviews-query.dto";
import { ReviewTrekkingRouteAction } from "../dto/review-trekking-route.dto";
import type { CheckpointsService } from "../services/checkpoints.service";
import type { RouteDangerZonesService } from "../services/route-danger-zones.service";
import type { TrekkingRoutesService } from "../services/trekking-routes.service";
import { TrekkingRoutesController } from "./trekking-routes.controller";

describe("TrekkingRoutesController pagination", () => {
	const user = {
		userId: "host-id",
		roles: [UserRole.HOST],
		status: UserStatus.ACTIVE,
	};

	function createController() {
		const service = {
			listByHost: jest.fn().mockResolvedValue([]),
			getOwnedById: jest.fn().mockResolvedValue({ id: "route-id" }),
			listByHostPaginated: jest.fn().mockResolvedValue({
				items: [],
				pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			}),
			listAdminReviews: jest.fn().mockResolvedValue({
				items: [],
				pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			}),
			review: jest.fn().mockResolvedValue({ id: "route-id", status: "draft" }),
		};
		const controller = new TrekkingRoutesController(
			service as unknown as TrekkingRoutesService,
			{} as CheckpointsService,
			{} as RouteDangerZonesService
		);
		return { controller, service };
	}

	it("forwards validated pagination with the authenticated Host id", async () => {
		const { controller, service } = createController();
		const query = { page: 2, limit: 10, status: "draft" as const };

		await controller.listPaginated({ user }, query);

		expect(service.listByHostPaginated).toHaveBeenCalledWith("host-id", query);
	});

	it("forwards default status filter query with the authenticated Host id", async () => {
		const { controller, service } = createController();
		const query = { page: 1, limit: 20, status: "all" as const };

		await controller.listPaginated({ user }, query);

		expect(service.listByHostPaginated).toHaveBeenCalledWith("host-id", query);
	});

	it("keeps the legacy unpaginated consumer contract available", async () => {
		const { controller, service } = createController();

		await expect(controller.list({ user })).resolves.toEqual([]);
		expect(service.listByHost).toHaveBeenCalledWith("host-id");
	});

	it("loads a Route detail with the authenticated Host id", async () => {
		const { controller, service } = createController();

		await expect(controller.getById({ user }, { routeId: "route-id" })).resolves.toEqual({
			id: "route-id",
		});
		expect(service.getOwnedById).toHaveBeenCalledWith("host-id", "route-id");
	});

	it("allows only Hosts to use both list contracts", () => {
		expect(
			Reflect.getMetadata(ROLES_KEY, TrekkingRoutesController.prototype.listPaginated)
		).toEqual([UserRole.HOST]);
		expect(Reflect.getMetadata(ROLES_KEY, TrekkingRoutesController.prototype.list)).toEqual([
			UserRole.HOST,
		]);
		expect(Reflect.getMetadata(ROLES_KEY, TrekkingRoutesController.prototype.getById)).toEqual([
			UserRole.HOST,
		]);
	});

	it("forwards an Admin review decision and keeps the endpoint Admin-only", async () => {
		const { controller, service } = createController();
		const adminRequest = {
			user: { userId: "admin-id", roles: [UserRole.ADMIN], status: UserStatus.ACTIVE },
		};
		const dto = {
			action: ReviewTrekkingRouteAction.DECLINE,
			reason: "Clarify the route geometry",
		};

		await controller.review(adminRequest, "route-id", dto);

		expect(service.review).toHaveBeenCalledWith("admin-id", "route-id", dto);
		expect(Reflect.getMetadata(ROLES_KEY, TrekkingRoutesController.prototype.review)).toEqual([
			UserRole.ADMIN,
		]);
	});

	it("forwards Admin review filters and keeps the listing Admin-only", async () => {
		const { controller, service } = createController();
		const query = { reviewOutcome: RouteReviewOutcome.APPROVED, page: 2, limit: 10 };

		await controller.listAdminReviews(query);

		expect(service.listAdminReviews).toHaveBeenCalledWith(query);
		expect(
			Reflect.getMetadata(ROLES_KEY, TrekkingRoutesController.prototype.listAdminReviews)
		).toEqual([UserRole.ADMIN]);
	});
});
