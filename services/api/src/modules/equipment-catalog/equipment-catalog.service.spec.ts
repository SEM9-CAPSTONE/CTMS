import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { EquipmentCatalogStatus } from "./equipment-catalog-status.enum";
import type { EquipmentCatalogRepository } from "./equipment-catalog.repository";
import { EquipmentCatalogService } from "./equipment-catalog.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_HOST_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";

function actor(userId: string, roles: string[]): AuthenticatedUser {
	return { userId, roles, status: UserStatus.ACTIVE };
}

function itemFixture(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: ITEM_ID,
		hostId: HOST_ID,
		name: "4-person tent",
		category: "shelter",
		quantityTotal: 10,
		rentalPricePerDay: 50000,
		status: EquipmentCatalogStatus.ACTIVE,
		maintenanceSchedule: null,
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		updatedAt: new Date("2026-09-01T00:00:00.000Z"),
		...overrides,
	};
}

describe("EquipmentCatalogService", () => {
	let service: EquipmentCatalogService;
	let items: {
		findMineByHost: jest.Mock;
		findOneBy: jest.Mock;
		findForUpdate: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};
	let auditRepository: { save: jest.Mock };
	let dataSource: { transaction: jest.Mock };

	beforeEach(() => {
		items = {
			findMineByHost: jest.fn(),
			findOneBy: jest.fn(),
			findForUpdate: jest.fn(),
			create: jest.fn().mockImplementation((input) => ({ ...input })),
			save: jest
				.fn()
				.mockImplementation((entity) => Promise.resolve({ ...itemFixture(), ...entity })),
		};
		auditRepository = { save: jest.fn().mockResolvedValue({}) };
		dataSource = {
			transaction: jest.fn(async (callback: (manager: unknown) => unknown) =>
				callback({
					withRepository: jest.fn().mockReturnValue(items),
					getRepository: jest.fn().mockReturnValue(auditRepository),
				})
			),
		};
		service = new EquipmentCatalogService(
			items as unknown as EquipmentCatalogRepository,
			dataSource as never
		);
	});

	describe("create", () => {
		it("creates a new item owned by the Host, defaulting no explicit status, and audits it", async () => {
			const result = await service.create(HOST_ID, {
				name: "4-person tent",
				category: "shelter",
				quantityTotal: 10,
				rentalPricePerDay: 50000,
				maintenanceSchedule: "Check zippers monthly",
			});

			expect(items.create).toHaveBeenCalledWith({
				hostId: HOST_ID,
				name: "4-person tent",
				category: "shelter",
				quantityTotal: 10,
				rentalPricePerDay: 50000,
				maintenanceSchedule: "Check zippers monthly",
			});
			expect(items.create.mock.calls[0][0]).not.toHaveProperty("status");
			expect(items.save).toHaveBeenCalledTimes(1);
			expect(result.hostId).toBe(HOST_ID);
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: HOST_ID,
					action: "equipment_catalog_item.created",
					targetType: "equipment_catalog_item",
					before: null,
				})
			);
		});

		it("defaults maintenanceSchedule to null when omitted", async () => {
			await service.create(HOST_ID, {
				name: "4-person tent",
				category: "shelter",
				quantityTotal: 10,
				rentalPricePerDay: 50000,
			});

			expect(items.create).toHaveBeenCalledWith(
				expect.objectContaining({ maintenanceSchedule: null })
			);
		});
	});

	describe("listMine", () => {
		it("returns the Host's own items mapped to the response shape", async () => {
			items.findMineByHost.mockResolvedValue([itemFixture(), itemFixture({ id: "other-item" })]);

			const result = await service.listMine(HOST_ID);

			expect(items.findMineByHost).toHaveBeenCalledWith(HOST_ID);
			expect(result).toHaveLength(2);
			expect(result[0].id).toBe(ITEM_ID);
		});
	});

	describe("getItem", () => {
		it("returns the item for the owning Host", async () => {
			items.findOneBy.mockResolvedValue(itemFixture());

			const result = await service.getItem(actor(HOST_ID, [UserRole.HOST]), ITEM_ID);

			expect(result.id).toBe(ITEM_ID);
		});

		it("allows an Admin to bypass ownership", async () => {
			items.findOneBy.mockResolvedValue(itemFixture());

			await expect(
				service.getItem(actor(ADMIN_ID, [UserRole.ADMIN]), ITEM_ID)
			).resolves.toBeDefined();
		});

		it("returns 403 when a different Host requests the item", async () => {
			items.findOneBy.mockResolvedValue(itemFixture());

			await expect(
				service.getItem(actor(OTHER_HOST_ID, [UserRole.HOST]), ITEM_ID)
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("returns 404 when the item does not exist", async () => {
			items.findOneBy.mockResolvedValue(null);

			await expect(
				service.getItem(actor(HOST_ID, [UserRole.HOST]), ITEM_ID)
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe("update", () => {
		it("applies only the supplied fields, saves once, and audits before/after", async () => {
			items.findForUpdate.mockResolvedValue(itemFixture());

			const result = await service.update(actor(HOST_ID, [UserRole.HOST]), ITEM_ID, {
				quantityTotal: 5,
				status: EquipmentCatalogStatus.INACTIVE,
			});

			expect(result.quantityTotal).toBe(5);
			expect(result.status).toBe(EquipmentCatalogStatus.INACTIVE);
			expect(result.name).toBe("4-person tent");
			expect(items.save).toHaveBeenCalledTimes(1);
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: HOST_ID,
					action: "equipment_catalog_item.updated",
					targetType: "equipment_catalog_item",
					targetId: ITEM_ID,
					before: expect.objectContaining({
						quantityTotal: 10,
						status: EquipmentCatalogStatus.ACTIVE,
					}),
					after: expect.objectContaining({
						quantityTotal: 5,
						status: EquipmentCatalogStatus.INACTIVE,
					}),
				})
			);
		});

		it("allows an Admin to update a different Host's item", async () => {
			items.findForUpdate.mockResolvedValue(itemFixture());

			await expect(
				service.update(actor(ADMIN_ID, [UserRole.ADMIN]), ITEM_ID, { quantityTotal: 1 })
			).resolves.toBeDefined();
		});

		it("returns 403 when a different Host attempts to update, with zero side effects", async () => {
			items.findForUpdate.mockResolvedValue(itemFixture());

			await expect(
				service.update(actor(OTHER_HOST_ID, [UserRole.HOST]), ITEM_ID, { quantityTotal: 1 })
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(items.save).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it("returns 404 when the item does not exist, with zero side effects", async () => {
			items.findForUpdate.mockResolvedValue(null);

			await expect(
				service.update(actor(HOST_ID, [UserRole.HOST]), ITEM_ID, { quantityTotal: 1 })
			).rejects.toBeInstanceOf(NotFoundException);
			expect(items.save).not.toHaveBeenCalled();
		});

		it("allows clearing maintenanceSchedule to null explicitly", async () => {
			items.findForUpdate.mockResolvedValue(itemFixture({ maintenanceSchedule: "Every 3 months" }));

			const result = await service.update(actor(HOST_ID, [UserRole.HOST]), ITEM_ID, {
				maintenanceSchedule: null,
			});

			expect(result.maintenanceSchedule).toBeNull();
		});
	});
});
