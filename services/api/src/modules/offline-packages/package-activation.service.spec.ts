import type { DataSource, EntityManager } from "typeorm";
import { PackageActivationService } from "./package-activation.service";
import type { PackageArtifactBuilder } from "./package-artifact.builder";
import type { PackageArtifactStorage } from "./package-artifact.storage";
import type { PackageFreshnessSource } from "./package-freshness.source";

describe("CTMS-305 departure policy short-circuit safety", () => {
	const query = jest.fn();
	const read = jest.fn();
	const manager = { query } as unknown as EntityManager;
	const source = { read } as PackageFreshnessSource;
	const service = new PackageActivationService(
		{} as DataSource,
		source,
		{} as PackageArtifactStorage,
		{} as PackageArtifactBuilder
	);
	beforeEach(() => {
		query.mockReset();
		read.mockReset();
	});
	it("legacy no-requirement path does not demand reports or query freshness", async () => {
		query.mockResolvedValueOnce([]);
		expect(await service.assertDepartureReady(manager, "trip", false)).toEqual({
			ready: true,
			reasonCode: "NO_REQUIRED_PACKAGE",
		});
		expect(query).toHaveBeenCalledTimes(1);
		expect(read).not.toHaveBeenCalled();
	});
	it("missing responsible-device evidence cannot lock anything", async () => {
		query.mockResolvedValueOnce([{ package_id: "package" }]).mockResolvedValueOnce([]);
		expect((await service.assertDepartureReady(manager, "trip", false)).reasonCode).toBe(
			"PACKAGE_DEPARTURE_NOT_READY"
		);
		expect(query).toHaveBeenCalledTimes(2);
		expect(read).not.toHaveBeenCalled();
	});
	it.each([
		["expired", "PACKAGE_SOURCE_EXPIRED"],
		["unknown", "SOURCE_FRESHNESS_UNAVAILABLE"],
	])("never locks a %s source", async (state, reason) => {
		query
			.mockResolvedValueOnce([{ package_id: "package" }])
			.mockResolvedValueOnce([{ package_id: "package" }]);
		read.mockResolvedValue({ state, expiresAt: null, reasonCodes: [] });
		expect(await service.assertDepartureReady(manager, "trip", false)).toEqual({
			ready: false,
			reasonCode: reason,
		});
		expect(query).toHaveBeenCalledTimes(2);
	});
	it("source provider outage fails closed instead of authorizing departure", async () => {
		query
			.mockResolvedValueOnce([{ package_id: "package" }])
			.mockResolvedValueOnce([{ package_id: "package" }]);
		read.mockRejectedValue(Error("provider offline"));
		expect(await service.assertDepartureReady(manager, "trip", false)).toEqual({
			ready: false,
			reasonCode: "SOURCE_FRESHNESS_UNAVAILABLE",
		});
		expect(query).toHaveBeenCalledTimes(2);
	});
});
