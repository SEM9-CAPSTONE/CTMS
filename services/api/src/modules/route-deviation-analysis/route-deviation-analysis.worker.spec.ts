import type { ConfigService } from "@nestjs/config";
import type { RouteDeviationAnalysisService } from "./route-deviation-analysis.service";
import { RouteDeviationAnalysisWorker } from "./route-deviation-analysis.worker";

const config = (values: Record<string, string>) =>
	({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe("RouteDeviationAnalysisWorker (CTMS-115)", () => {
	it("stays idle unless enabled and analyses one batch per tick", async () => {
		const service = {
			analyzeDueTrips: jest.fn().mockResolvedValue({ checked: 0, analyzed: 0, failed: 0 }),
		};
		const idle = new RouteDeviationAnalysisWorker(
			config({}),
			service as unknown as RouteDeviationAnalysisService
		);
		idle.onApplicationBootstrap();
		expect(service.analyzeDueTrips).not.toHaveBeenCalled();

		const worker = new RouteDeviationAnalysisWorker(
			config({ ROUTE_DEVIATION_ANALYSIS_BATCH_SIZE: "7" }),
			service as unknown as RouteDeviationAnalysisService
		);
		await worker.startTick();
		expect(service.analyzeDueTrips).toHaveBeenCalledWith(7);
		await worker.onApplicationShutdown();
	});

	it("survives a failed pass", async () => {
		const service = { analyzeDueTrips: jest.fn().mockRejectedValue(new Error("db down")) };
		const worker = new RouteDeviationAnalysisWorker(
			config({}),
			service as unknown as RouteDeviationAnalysisService
		);
		await expect(worker.startTick()).resolves.toBeUndefined();
	});
});
