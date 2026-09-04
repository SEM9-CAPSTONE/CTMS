import type { Campsite } from "../../campsites/entities/campsite.entity";
import type { CreateRouteDangerZoneDto } from "../dto/create-route-danger-zone.dto";
import { RouteDangerZoneSeverity } from "../entities/route-danger-zone.entity";
import { TrekkingRouteDifficulty, TrekkingRouteStatus } from "../entities/trekking-route.entity";
import type { RouteDangerZonesRepository } from "../repositories/route-danger-zones.repository";
import { RouteDangerZonesService } from "./route-danger-zones.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_HOST_ID = "22222222-2222-4222-8222-222222222222";
const CAMPSITE_ID = "33333333-3333-4333-8333-333333333333";
const ROUTE_ID = "44444444-4444-4444-8444-444444444444";
const DANGER_ZONE_ID = "55555555-5555-4555-8555-555555555555";

const dto: CreateRouteDangerZoneDto = {
	geometry: { type: "Point", coordinates: [108.46, 11.94] },
	radiusMeters: 50,
	description: "Falling-rock area",
	severity: RouteDangerZoneSeverity.MEDIUM,
};

const dangerZone = {
	id: DANGER_ZONE_ID,
	routeId: ROUTE_ID,
	...dto,
	radiusMeters: 50,
	createdAt: new Date("2026-09-04T00:00:00.000Z"),
	updatedAt: new Date("2026-09-04T00:00:00.000Z"),
};

function route(hostId = HOST_ID, status = TrekkingRouteStatus.DRAFT) {
	return {
		id: ROUTE_ID,
		campsiteId: CAMPSITE_ID,
		campsite: { id: CAMPSITE_ID, hostId } as Campsite,
		name: "Pine trail",
		description: null,
		routeGeom: {
			type: "LineString" as const,
			coordinates: [
				[108.45, 11.94],
				[108.47, 11.94],
			] as Array<[number, number]>,
		},
		lengthMeters: 2100,
		difficulty: TrekkingRouteDifficulty.MODERATE,
		expectedDurationMinutes: 120,
		status,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

describe("RouteDangerZonesService", () => {
	let routeQuery: {
		innerJoinAndSelect: jest.Mock;
		where: jest.Mock;
		setLock: jest.Mock;
		getOne: jest.Mock;
	};
	let routeRepository: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
	let dangerZoneRepository: { findByRoute: jest.Mock; createForRoute: jest.Mock };
	let auditRepository: { save: jest.Mock };
	let manager: { getRepository: jest.Mock; withRepository: jest.Mock };
	let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
	let service: RouteDangerZonesService;

	beforeEach(() => {
		routeQuery = {
			innerJoinAndSelect: jest.fn(),
			where: jest.fn(),
			setLock: jest.fn(),
			getOne: jest.fn().mockResolvedValue(route()),
		};
		routeQuery.innerJoinAndSelect.mockReturnValue(routeQuery);
		routeQuery.where.mockReturnValue(routeQuery);
		routeQuery.setLock.mockReturnValue(routeQuery);
		routeRepository = {
			findOne: jest.fn().mockResolvedValue(route()),
			createQueryBuilder: jest.fn().mockReturnValue(routeQuery),
		};
		dangerZoneRepository = {
			findByRoute: jest.fn().mockResolvedValue([dangerZone]),
			createForRoute: jest.fn().mockResolvedValue(dangerZone),
		};
		auditRepository = { save: jest.fn().mockResolvedValue({}) };
		manager = {
			getRepository: jest.fn((entity: { name?: string }) =>
				entity.name === "TrekkingRoute" ? routeRepository : auditRepository
			),
			withRepository: jest.fn().mockReturnValue(dangerZoneRepository),
		};
		dataSource = {
			getRepository: jest.fn().mockReturnValue(routeRepository),
			transaction: jest.fn(async (callback: (value: typeof manager) => unknown) =>
				callback(manager)
			),
		};
		service = new RouteDangerZonesService(
			dangerZoneRepository as unknown as RouteDangerZonesRepository,
			dataSource as never
		);
	});

	it("lists danger zones only after verifying Route ownership", async () => {
		await expect(service.list(HOST_ID, ROUTE_ID)).resolves.toEqual([dangerZone]);
		expect(routeRepository.findOne).toHaveBeenCalledWith({
			where: { id: ROUTE_ID },
			relations: { campsite: true },
		});
		expect(dangerZoneRepository.findByRoute).toHaveBeenCalledWith(ROUTE_ID);
	});

	it("returns 404 for a missing Route and 403 for a foreign Host before listing", async () => {
		routeRepository.findOne.mockResolvedValueOnce(null);
		await expect(service.list(HOST_ID, ROUTE_ID)).rejects.toMatchObject({ status: 404 });
		routeRepository.findOne.mockResolvedValueOnce(route(OTHER_HOST_ID));
		await expect(service.list(HOST_ID, ROUTE_ID)).rejects.toMatchObject({ status: 403 });
		expect(dangerZoneRepository.findByRoute).not.toHaveBeenCalled();
	});

	it("locks a draft Route, persists the danger zone, and audits in one transaction", async () => {
		await expect(service.create(HOST_ID, ROUTE_ID, dto)).resolves.toEqual(dangerZone);
		expect(routeRepository.createQueryBuilder).toHaveBeenCalledWith("route");
		expect(routeQuery.innerJoinAndSelect).toHaveBeenCalledWith("route.campsite", "campsite");
		expect(routeQuery.where).toHaveBeenCalledWith("route.id = :routeId", { routeId: ROUTE_ID });
		expect(routeQuery.setLock).toHaveBeenCalledWith("pessimistic_write");
		expect(dangerZoneRepository.createForRoute).toHaveBeenCalledWith({
			routeId: ROUTE_ID,
			geometry: dto.geometry,
			radiusMeters: 50,
			description: dto.description,
			severity: dto.severity,
		});
		expect(auditRepository.save).toHaveBeenCalledWith({
			actorId: HOST_ID,
			action: "trekking_route_danger_zone.created",
			targetType: "trekking_route_danger_zone",
			targetId: DANGER_ZONE_ID,
			before: null,
			after: {
				id: DANGER_ZONE_ID,
				routeId: ROUTE_ID,
				geometry: dto.geometry,
				radiusMeters: 50,
				description: dto.description,
				severity: dto.severity,
			},
			reason: "host_create_trekking_route_danger_zone",
		});
	});

	it("persists null radius for Polygon geometry", async () => {
		const polygonDto: CreateRouteDangerZoneDto = {
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[108.45, 11.94],
						[108.46, 11.94],
						[108.46, 11.95],
						[108.45, 11.94],
					],
				],
			},
			description: "Landslide area",
			severity: RouteDangerZoneSeverity.HIGH,
		};
		await service.create(HOST_ID, ROUTE_ID, polygonDto);
		expect(dangerZoneRepository.createForRoute).toHaveBeenCalledWith(
			expect.objectContaining({ radiusMeters: null })
		);
	});

	it("returns 404 or 403 before create persistence and audit", async () => {
		routeQuery.getOne.mockResolvedValueOnce(null);
		await expect(service.create(HOST_ID, ROUTE_ID, dto)).rejects.toMatchObject({ status: 404 });
		routeQuery.getOne.mockResolvedValueOnce(route(OTHER_HOST_ID));
		await expect(service.create(HOST_ID, ROUTE_ID, dto)).rejects.toMatchObject({ status: 403 });
		expect(dangerZoneRepository.createForRoute).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it.each([
		TrekkingRouteStatus.PENDING_APPROVAL,
		TrekkingRouteStatus.ACTIVE,
		TrekkingRouteStatus.CLOSED,
	])("rejects a %s Route with 409 before persistence or audit", async (status) => {
		routeQuery.getOne.mockResolvedValue(route(HOST_ID, status));
		await expect(service.create(HOST_ID, ROUTE_ID, dto)).rejects.toMatchObject({ status: 409 });
		expect(dangerZoneRepository.createForRoute).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it("propagates audit failure so the transaction can roll back persistence", async () => {
		auditRepository.save.mockRejectedValue(new Error("audit unavailable"));
		await expect(service.create(HOST_ID, ROUTE_ID, dto)).rejects.toThrow("audit unavailable");
		expect(dangerZoneRepository.createForRoute).toHaveBeenCalledTimes(1);
	});
});
