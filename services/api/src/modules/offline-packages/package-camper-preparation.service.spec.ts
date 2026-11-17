import type { DataSource } from "typeorm";
import {
	CAMPER_OFFLINE_NOTICE,
	PackageCamperPreparationService,
} from "./package-camper-preparation.service";

describe("Camper offline acknowledgement", () => {
	const context = {
		status: "published",
		startsAt: new Date("2026-12-01T09:00:00Z"),
		packageId: "required",
		packageVersion: 2,
		confirmedAt: null,
	};
	const query = jest.fn();
	const manager = { query };
	const db = { manager, transaction: (work: (m: unknown) => unknown) => work(manager) };
	const service = new PackageCamperPreparationService(db as unknown as DataSource);
	beforeEach(() => query.mockReset());

	it("rejects a different package context after acquiring the Trip lock", async () => {
		query
			.mockResolvedValueOnce([context])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([context]);
		await expect(
			service.confirm("trip", "camper", "old", CAMPER_OFFLINE_NOTICE)
		).rejects.toMatchObject({
			response: { code: "PREPARATION_CONTEXT_CHANGED" },
		});
		expect(query).toHaveBeenCalledTimes(3);
	});

	it("rejects an outsider before attempting to record an acknowledgement", async () => {
		query.mockResolvedValueOnce([]);
		await expect(
			service.confirm("trip", "outsider", "required", CAMPER_OFFLINE_NOTICE)
		).rejects.toMatchObject({
			response: { code: "TRIP_NOT_ACCESSIBLE" },
		});
		expect(query).toHaveBeenCalledTimes(1);
	});

	it("records server-scoped acknowledgement and audit while leaving departure untouched", async () => {
		const confirmedAt = new Date("2026-11-30T09:00:00Z");
		query
			.mockResolvedValueOnce([context])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([context])
			.mockResolvedValueOnce([{ id: "ack" }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ ...context, confirmedAt }]);
		await expect(
			service.confirm("trip", "camper", "required", CAMPER_OFFLINE_NOTICE)
		).resolves.toMatchObject({
			confirmedAt,
		});
		expect(query).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO offline_package_camper_acknowledgements"),
			["trip", "camper", "required", CAMPER_OFFLINE_NOTICE]
		);
		expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO audit_logs"), [
			"camper",
			"trip",
			"ack",
			"required",
			CAMPER_OFFLINE_NOTICE,
		]);
		expect(
			query.mock.calls.some(([sql]) =>
				/(?:INSERT INTO|UPDATE) offline_package_departures/.test(sql)
			)
		).toBe(false);
	});
});
