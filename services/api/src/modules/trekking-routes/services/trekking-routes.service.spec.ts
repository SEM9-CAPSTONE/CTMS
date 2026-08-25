import type { Campsite } from "../../campsites/entities/campsite.entity";
import { TrekkingRouteDifficulty, TrekkingRouteStatus } from "../entities/trekking-route.entity";
import type { TrekkingRoutesRepository } from "../repositories/trekking-routes.repository";
import { TrekkingRoutesService } from "./trekking-routes.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const CAMPSITE_ID = "22222222-2222-4222-8222-222222222222";
const ROUTE_ID = "33333333-3333-4333-8333-333333333333";

function createDto() {
	return {
		campsiteId: CAMPSITE_ID,
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

function createdRoute() {
	return {
		id: ROUTE_ID,
		...createDto(),
		description: "Ridge route",
		lengthMeters: 1024.5,
		status: TrekkingRouteStatus.DRAFT,
		createdAt: new Date("2026-08-24T00:00:00.000Z"),
		updatedAt: new Date("2026-08-24T00:00:00.000Z"),
	};
}

describe("TrekkingRoutesService", () => {
	let campsiteRepository: { findOne: jest.Mock };
	let routeRepository: { createDraft: jest.Mock; findByCampsite: jest.Mock };
	let auditRepository: { save: jest.Mock };
	let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
	let service: TrekkingRoutesService;

	beforeEach(() => {
		campsiteRepository = { findOne: jest.fn() };
		routeRepository = {
			createDraft: jest.fn().mockResolvedValue(createdRoute()),
			findByCampsite: jest.fn().mockResolvedValue([createdRoute()]),
		};
		auditRepository = { save: jest.fn().mockResolvedValue({}) };
		dataSource = {
			getRepository: jest.fn().mockReturnValue(campsiteRepository),
			transaction: jest.fn(async (callback: (manager: unknown) => unknown) =>
				callback({
					getRepository: jest.fn((entity: { name?: string }) =>
						entity.name === "Campsite" ? campsiteRepository : auditRepository
					),
					withRepository: jest.fn().mockReturnValue(routeRepository),
				})
			),
		};
		service = new TrekkingRoutesService(
			routeRepository as unknown as TrekkingRoutesRepository,
			dataSource as never
		);
	});

	describe("listByCampsite", () => {
		it("returns only routes from the requested owned campsite", async () => {
			campsiteRepository.findOne.mockResolvedValue({
				id: CAMPSITE_ID,
				hostId: HOST_ID,
			} as Campsite);

			const routes = await service.listByCampsite(HOST_ID, CAMPSITE_ID);

			expect(campsiteRepository.findOne).toHaveBeenCalledWith({ where: { id: CAMPSITE_ID } });
			expect(routeRepository.findByCampsite).toHaveBeenCalledWith(CAMPSITE_ID);
			expect(routes).toEqual([createdRoute()]);
		});

		it("returns 404 for a missing campsite without querying routes", async () => {
			campsiteRepository.findOne.mockResolvedValue(null);

			await expect(service.listByCampsite(HOST_ID, CAMPSITE_ID)).rejects.toMatchObject({
				status: 404,
			});
			expect(routeRepository.findByCampsite).not.toHaveBeenCalled();
		});

		it("returns 403 for another Host's campsite without querying routes", async () => {
			campsiteRepository.findOne.mockResolvedValue({
				id: CAMPSITE_ID,
				hostId: "other-host",
			} as Campsite);

			await expect(service.listByCampsite(HOST_ID, CAMPSITE_ID)).rejects.toMatchObject({
				status: 403,
			});
			expect(routeRepository.findByCampsite).not.toHaveBeenCalled();
		});
	});

	it("creates a draft route for an owned campsite and writes a summarized audit", async () => {
		campsiteRepository.findOne.mockResolvedValue({ id: CAMPSITE_ID, hostId: HOST_ID } as Campsite);

		const route = await service.create(HOST_ID, createDto());

		expect(campsiteRepository.findOne).toHaveBeenCalledWith({
			where: { id: CAMPSITE_ID },
			lock: { mode: "pessimistic_read" },
		});
		expect(routeRepository.createDraft).toHaveBeenCalledWith(
			expect.objectContaining({ campsiteId: CAMPSITE_ID, name: "Pine Ridge Trail" })
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

	it("returns 404 for a missing campsite without route or audit side effects", async () => {
		campsiteRepository.findOne.mockResolvedValue(null);

		await expect(service.create(HOST_ID, createDto())).rejects.toMatchObject({ status: 404 });
		expect(routeRepository.createDraft).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it("returns 403 for another Host's campsite without route or audit side effects", async () => {
		campsiteRepository.findOne.mockResolvedValue({
			id: CAMPSITE_ID,
			hostId: "other-host",
		} as Campsite);

		await expect(service.create(HOST_ID, createDto())).rejects.toMatchObject({ status: 403 });
		expect(routeRepository.createDraft).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it("propagates audit failure so the transaction can roll back route creation", async () => {
		campsiteRepository.findOne.mockResolvedValue({ id: CAMPSITE_ID, hostId: HOST_ID } as Campsite);
		auditRepository.save.mockRejectedValue(new Error("audit unavailable"));

		await expect(service.create(HOST_ID, createDto())).rejects.toThrow("audit unavailable");
		expect(routeRepository.createDraft).toHaveBeenCalledTimes(1);
	});
});
