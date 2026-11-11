import type { ConfigService } from "@nestjs/config";
import type { TripAutoCancelService } from "./trip-auto-cancel.service";
import { TripAutoCancelWorker } from "./trip-auto-cancel.worker";

function deferred(): {
	promise: Promise<void>;
	resolve: () => void;
} {
	let resolvePromise: (() => void) | undefined;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	return { promise, resolve: () => resolvePromise?.() };
}

describe("TripAutoCancelWorker", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	function build(
		values: Record<string, string>,
		autoCancelDueTrips: jest.Mock = jest.fn().mockResolvedValue(undefined)
	): { worker: TripAutoCancelWorker; autoCancelDueTrips: jest.Mock } {
		const configService = {
			get: jest.fn((key: string) => values[key]),
		} as unknown as ConfigService;
		return {
			worker: new TripAutoCancelWorker(configService, {
				autoCancelDueTrips,
			} as unknown as TripAutoCancelService),
			autoCancelDueTrips,
		};
	}

	it("does not schedule or run when disabled", () => {
		jest.useFakeTimers();
		const { worker, autoCancelDueTrips } = build({ TRIP_AUTO_CANCEL_WORKER_ENABLED: "false" });
		worker.onApplicationBootstrap();
		jest.advanceTimersByTime(120_000);
		expect(autoCancelDueTrips).not.toHaveBeenCalled();
	});

	it("runs immediately and then at the configured interval with bounded batch size", async () => {
		jest.useFakeTimers();
		const { worker, autoCancelDueTrips } = build({
			TRIP_AUTO_CANCEL_WORKER_ENABLED: "true",
			TRIP_AUTO_CANCEL_INTERVAL_MS: "5000",
			TRIP_AUTO_CANCEL_BATCH_SIZE: "12",
		});
		worker.onApplicationBootstrap();
		await Promise.resolve();
		await Promise.resolve();
		expect(autoCancelDueTrips).toHaveBeenCalledWith(12);
		await jest.advanceTimersByTimeAsync(5000);
		expect(autoCancelDueTrips).toHaveBeenCalledTimes(2);
		await worker.onApplicationShutdown();
	});

	it("prevents overlapping local ticks", async () => {
		jest.useFakeTimers();
		const active = deferred();
		const autoCancelDueTrips = jest.fn().mockReturnValue(active.promise);
		const { worker } = build(
			{
				TRIP_AUTO_CANCEL_WORKER_ENABLED: "true",
				TRIP_AUTO_CANCEL_INTERVAL_MS: "1000",
			},
			autoCancelDueTrips
		);
		worker.onApplicationBootstrap();
		jest.advanceTimersByTime(5000);
		expect(autoCancelDueTrips).toHaveBeenCalledTimes(1);
		active.resolve();
		await Promise.resolve();
		await worker.onApplicationShutdown();
	});

	it("shutdown stops future ticks", async () => {
		jest.useFakeTimers();
		const { worker, autoCancelDueTrips } = build({
			TRIP_AUTO_CANCEL_WORKER_ENABLED: "true",
			TRIP_AUTO_CANCEL_INTERVAL_MS: "1000",
		});
		worker.onApplicationBootstrap();
		await Promise.resolve();
		await worker.onApplicationShutdown();
		jest.advanceTimersByTime(5000);
		expect(autoCancelDueTrips).toHaveBeenCalledTimes(1);
	});

	it("shutdown awaits an active tick", async () => {
		jest.useFakeTimers();
		const active = deferred();
		const { worker } = build(
			{ TRIP_AUTO_CANCEL_WORKER_ENABLED: "true" },
			jest.fn().mockReturnValue(active.promise)
		);
		worker.onApplicationBootstrap();
		let completed = false;
		const shutdown = worker.onApplicationShutdown().then(() => {
			completed = true;
		});
		await Promise.resolve();
		expect(completed).toBe(false);
		active.resolve();
		await shutdown;
		expect(completed).toBe(true);
	});
});
