import { ConfigService } from "@nestjs/config";
import type { DataSource } from "typeorm";
import { SafetyImportService } from "./safety-import.service";

describe("SafetyImportService BR-478", () => {
	const db = { query: jest.fn(), transaction: jest.fn() };
	const dto = {
		source: "APPROVED_FILE",
		permissionReference: "agreement",
		features: [
			{
				externalId: "1",
				sourceType: "OFFICIAL_CURRENT",
				sourceReference: "ref",
				hazardType: "landslide",
				severity: "HIGH",
				geometry: { type: "Point", coordinates: [108, 12] },
				geometryRole: "source_marker",
				description: "Warning",
				observedAt: "2026-10-29T12:00:00Z",
				lifecycleStatus: "ACTIVE",
				verificationStatus: "SOURCE_PROVIDED",
			},
		],
	};
	beforeEach(() => jest.clearAllMocks());
	it("rejects unapproved sources before writing", async () => {
		const service = new SafetyImportService(db as unknown as DataSource, new ConfigService());
		await expect(service.import("admin", dto)).rejects.toThrow("approved");
		expect(db.transaction).not.toHaveBeenCalled();
	});
	it("quarantines invalid data without discarding independent valid records", async () => {
		const service = new SafetyImportService(
			db as unknown as DataSource,
			new ConfigService({ ROUTE_SAFETY_APPROVED_SOURCES: "APPROVED_FILE" })
		);
		db.query.mockResolvedValue([]);
		db.transaction.mockResolvedValue(true);
		await expect(
			service.import("admin", { ...dto, features: [null, ...dto.features] })
		).resolves.toEqual({ accepted: 1, rejected: 1, unchanged: 0 });
		expect(db.query).toHaveBeenCalledTimes(1);
	});
	it("propagates storage failures rather than claiming bad provider data", async () => {
		const service = new SafetyImportService(
			db as unknown as DataSource,
			new ConfigService({ ROUTE_SAFETY_APPROVED_SOURCES: "APPROVED_FILE" })
		);
		db.transaction.mockRejectedValue(new Error("database unavailable"));
		await expect(service.import("admin", dto)).rejects.toThrow("database unavailable");
		expect(db.query).not.toHaveBeenCalled();
	});
});
