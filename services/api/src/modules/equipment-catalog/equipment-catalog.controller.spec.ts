import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import type { EquipmentCatalogItemResponseDto } from "./dto/equipment-catalog-item-response.dto";
import { EquipmentCatalogStatus } from "./equipment-catalog-status.enum";
import { EquipmentCatalogController } from "./equipment-catalog.controller";
import type { EquipmentCatalogService } from "./equipment-catalog.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";

const HOST_ACTOR: AuthenticatedUser = {
	userId: HOST_ID,
	roles: [UserRole.HOST],
	status: UserStatus.ACTIVE,
};

function itemResponse(): EquipmentCatalogItemResponseDto {
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
	};
}

describe("EquipmentCatalogController", () => {
	let catalog: {
		create: jest.Mock;
		listMine: jest.Mock;
		getItem: jest.Mock;
		update: jest.Mock;
	};
	let controller: EquipmentCatalogController;

	beforeEach(() => {
		catalog = {
			create: jest.fn(),
			listMine: jest.fn(),
			getItem: jest.fn(),
			update: jest.fn(),
		};
		controller = new EquipmentCatalogController(catalog as unknown as EquipmentCatalogService);
	});

	it("create delegates to EquipmentCatalogService.create with the Host's userId and dto", async () => {
		const dto = {
			name: "4-person tent",
			category: "shelter",
			quantityTotal: 10,
			rentalPricePerDay: 50000,
		};
		catalog.create.mockResolvedValue(itemResponse());

		const result = await controller.create({ user: HOST_ACTOR }, dto);

		expect(catalog.create).toHaveBeenCalledWith(HOST_ID, dto);
		expect(result).toEqual(itemResponse());
	});

	it("listMine delegates to EquipmentCatalogService.listMine with the Host's userId", async () => {
		catalog.listMine.mockResolvedValue([itemResponse()]);

		const result = await controller.listMine({ user: HOST_ACTOR });

		expect(catalog.listMine).toHaveBeenCalledWith(HOST_ID);
		expect(result).toEqual([itemResponse()]);
	});

	it("getItem delegates to EquipmentCatalogService.getItem with the actor and itemId", async () => {
		catalog.getItem.mockResolvedValue(itemResponse());

		const result = await controller.getItem({ user: HOST_ACTOR }, ITEM_ID);

		expect(catalog.getItem).toHaveBeenCalledWith(HOST_ACTOR, ITEM_ID);
		expect(result).toEqual(itemResponse());
	});

	it("update delegates to EquipmentCatalogService.update with the actor, itemId, and dto", async () => {
		const dto = { quantityTotal: 5 };
		catalog.update.mockResolvedValue({ ...itemResponse(), quantityTotal: 5 });

		const result = await controller.update({ user: HOST_ACTOR }, ITEM_ID, dto);

		expect(catalog.update).toHaveBeenCalledWith(HOST_ACTOR, ITEM_ID, dto);
		expect(result.quantityTotal).toBe(5);
	});
});
