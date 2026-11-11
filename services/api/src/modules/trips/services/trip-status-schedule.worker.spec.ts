import type { ConfigService } from "@nestjs/config";
import type { TripStatusScheduleService } from "./trip-status-schedule.service";
import { TripStatusScheduleWorker } from "./trip-status-schedule.worker";

describe("TripStatusScheduleWorker", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	function build(values: Record<string, string>) {
		const advanceDueTrips = jest.fn().mockResolvedValue({ started: 0, completed: 0 });
		const configService = {
			get: jest.fn((key: string) => values[key]),
		} as unknown as ConfigService;
		return {
			worker: new TripStatusScheduleWorker(configService, {
				advanceDueTrips,
			} as unknown as TripStatusScheduleService),
			advanceDueTrips,
		};
	}

	it("does not run when disabled", () => {
		jest.useFakeTimers();
		const { worker, advanceDueTrips } = build({ TRIP_STATUS_WORKER_ENABLED: "false" });
		worker.onApplicationBootstrap();
		jest.advanceTimersByTime(120_000);
		expect(advanceDueTrips).not.toHaveBeenCalled();
	});

	it("runs immediately and on each interval with the configured batch size", async () => {
		jest.useFakeTimers();
		const { worker, advanceDueTrips } = build({
			TRIP_STATUS_WORKER_ENABLED: "true",
			TRIP_STATUS_WORKER_INTERVAL_MS: "1000",
			TRIP_STATUS_WORKER_BATCH_SIZE: "25",
		});
		worker.onApplicationBootstrap();
		expect(advanceDueTrips).toHaveBeenCalledWith(25);
		await jest.advanceTimersByTimeAsync(1_000);
		expect(advanceDueTrips).toHaveBeenCalledTimes(2);
		await worker.onApplicationShutdown();
	});

	it("skips a tick while the previous one is still running", async () => {
		jest.useFakeTimers();
		const { worker, advanceDueTrips } = build({
			TRIP_STATUS_WORKER_ENABLED: "true",
			TRIP_STATUS_WORKER_INTERVAL_MS: "1000",
		});
		let finish: () => void = () => {};
		advanceDueTrips.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = () => resolve({ started: 0, completed: 0 });
			})
		);
		worker.onApplicationBootstrap();
		jest.advanceTimersByTime(3_000);
		expect(advanceDueTrips).toHaveBeenCalledTimes(1);
		finish();
		await worker.onApplicationShutdown();
	});
});
