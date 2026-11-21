import type { HotspotCorrectiveActionsRepository } from "./hotspot-corrective-actions.repository";
import { HotspotCorrectiveActionsService } from "./hotspot-corrective-actions.service";

const HOTSPOT = "6f1c1d1e-0000-4000-8000-000000000002";

describe("HotspotCorrectiveActionsService (CTMS-118 history)", () => {
	it("lists the corrective actions already taken from a hotspot", async () => {
		const rows = [{ id: "action-1" }];
		const repository = { listByHotspot: jest.fn().mockResolvedValue(rows) };
		const service = new HotspotCorrectiveActionsService(
			repository as unknown as HotspotCorrectiveActionsRepository
		);
		await expect(service.listByHotspot(HOTSPOT)).resolves.toBe(rows);
		expect(repository.listByHotspot).toHaveBeenCalledWith(HOTSPOT);
	});

	it("no longer offers a way to create corrective actions", () => {
		expect(HotspotCorrectiveActionsService.prototype).not.toHaveProperty("create");
		expect(HotspotCorrectiveActionsService.prototype).not.toHaveProperty("targets");
	});
});
