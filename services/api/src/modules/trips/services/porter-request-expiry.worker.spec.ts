import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { PorterRequestExpiryWorker } from "./porter-request-expiry.worker";
import type { PorterRequestsService } from "./porter-requests.service";

function build(enabled?: string) {
	const expirePending = jest.fn<Promise<number>, [number]>().mockResolvedValue(0);
	const config = { get: jest.fn(() => enabled) };
	return {
		expirePending,
		worker: new PorterRequestExpiryWorker(
			config as unknown as ConfigService,
			{ expirePending } as unknown as PorterRequestsService
		),
	};
}

describe("PorterRequestExpiryWorker", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});
	it("does not run when disabled or implicitly enabled in tests", () => {
		for (const enabled of ["false", undefined]) {
			const h = build(enabled);
			h.worker.onApplicationBootstrap();
			jest.advanceTimersByTime(120_000);
			expect(h.expirePending).not.toHaveBeenCalled();
		}
	});
	it("runs immediately, periodically and stops at shutdown", async () => {
		const h = build("true");
		h.worker.onApplicationBootstrap();
		await jest.advanceTimersByTimeAsync(60_000);
		expect(h.expirePending).toHaveBeenCalledTimes(2);
		expect(h.expirePending).toHaveBeenCalledWith(100);
		await h.worker.onApplicationShutdown();
		await jest.advanceTimersByTimeAsync(60_000);
		expect(h.expirePending).toHaveBeenCalledTimes(2);
	});
	it("prevents overlapping ticks and drains an active batch at shutdown", async () => {
		const h = build("true");
		let resolve: ((count: number) => void) | undefined;
		h.expirePending.mockReturnValue(
			new Promise<number>((done) => {
				resolve = done;
			})
		);
		h.worker.onApplicationBootstrap();
		jest.advanceTimersByTime(180_000);
		expect(h.expirePending).toHaveBeenCalledTimes(1);
		let stopped = false;
		const stop = h.worker.onApplicationShutdown().then(() => {
			stopped = true;
		});
		await Promise.resolve();
		expect(stopped).toBe(false);
		resolve?.(0);
		await stop;
		expect(stopped).toBe(true);
	});
	it("recovers after a failed batch", async () => {
		jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
		const h = build("true");
		h.expirePending.mockRejectedValueOnce(new Error("DB unavailable"));
		h.worker.onApplicationBootstrap();
		await jest.advanceTimersByTimeAsync(60_000);
		expect(h.expirePending).toHaveBeenCalledTimes(2);
		await h.worker.onApplicationShutdown();
	});
});
