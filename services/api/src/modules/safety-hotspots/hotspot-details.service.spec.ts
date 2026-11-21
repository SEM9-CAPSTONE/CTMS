import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateSafetyHotspotDto } from "./dto/update-safety-hotspot.dto";
import { HotspotDetailsErrorCode, HotspotDetailsService } from "./hotspot-details.service";

const ACTOR = "6f1c1d1e-0000-4000-8000-000000000001";
const HOTSPOT = "6f1c1d1e-0000-4000-8000-000000000002";

function setup(options: { exists?: boolean; corrections?: number } = {}) {
	const auditSave = jest.fn().mockResolvedValue(undefined);
	const query = jest.fn(async (sql: string) => {
		if (sql.includes("FOR UPDATE")) {
			return options.exists === false
				? []
				: [
						{
							id: HOTSPOT,
							routeId: "route-1",
							status: "CONFIRMED",
							name: null,
							description: null,
							severity: null,
						},
					];
		}
		if (sql.includes("hotspot_corrective_actions")) return [{ count: options.corrections ?? 0 }];
		return [];
	});
	const manager = { query, getRepository: jest.fn(() => ({ save: auditSave })) };
	const dataSource = {
		transaction: jest.fn((work: (m: unknown) => Promise<unknown>) => work(manager)),
	};
	return { service: new HotspotDetailsService(dataSource as never), query, auditSave };
}

const dto = (values: Record<string, unknown>) => plainToInstance(UpdateSafetyHotspotDto, values);

describe("HotspotDetailsService", () => {
	it("updates the details and audits before and after", async () => {
		const { service, query, auditSave } = setup();
		await service.update(
			ACTOR,
			HOTSPOT,
			dto({ name: "Dốc Vọng Cảnh", description: "", severity: "high" })
		);
		expect(query).toHaveBeenCalledWith(expect.stringContaining("UPDATE"), [
			HOTSPOT,
			"Dốc Vọng Cảnh",
			null,
			"high",
		]);
		expect(auditSave).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "safety_hotspot.updated",
				before: { name: null, description: null, severity: null },
				after: { name: "Dốc Vọng Cảnh", description: null, severity: "high" },
			})
		);
	});

	it("deletes a hotspot that never changed Route data and audits it", async () => {
		const { service, query, auditSave } = setup();
		await service.remove(ACTOR, HOTSPOT);
		expect(query).toHaveBeenCalledWith(expect.stringContaining("DELETE"), [HOTSPOT]);
		expect(auditSave).toHaveBeenCalledWith(
			expect.objectContaining({ action: "safety_hotspot.deleted", after: null })
		);
	});

	it("keeps a hotspot that already changed Route safety data", async () => {
		const { service, query, auditSave } = setup({ corrections: 1 });
		await expect(service.remove(ACTOR, HOTSPOT)).rejects.toMatchObject({
			response: { code: HotspotDetailsErrorCode.HOTSPOT_HAS_CORRECTIONS },
		});
		expect(query).not.toHaveBeenCalledWith(expect.stringContaining("DELETE"), expect.anything());
		expect(auditSave).not.toHaveBeenCalled();
	});

	it("answers 404 for an unknown hotspot", async () => {
		const { service } = setup({ exists: false });
		await expect(service.remove(ACTOR, HOTSPOT)).rejects.toMatchObject({ status: 404 });
		await expect(
			service.update(ACTOR, HOTSPOT, dto({ name: "A", description: "", severity: "low" }))
		).rejects.toMatchObject({ status: 404 });
	});
});

describe("UpdateSafetyHotspotDto", () => {
	it("requires a name, limits lengths and accepts only known severities", async () => {
		expect(
			await validate(dto({ name: "  Ngã ba suối ", description: "", severity: "medium" }))
		).toEqual([]);
		for (const bad of [
			{ name: "   ", description: "", severity: "low" },
			{ name: "x".repeat(121), description: "", severity: "low" },
			{ name: "A", description: "x".repeat(1001), severity: "low" },
			{ name: "A", description: "", severity: "extreme" },
		]) {
			expect((await validate(dto(bad))).length).toBeGreaterThan(0);
		}
	});
});
