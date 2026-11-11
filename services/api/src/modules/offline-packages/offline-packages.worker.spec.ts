import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { OfflinePackagesModule } from "./offline-packages.module";
import type { OfflinePackagesRepository } from "./offline-packages.repository";
import { OfflinePackagesService } from "./offline-packages.service";
import {
	OfflineSafetySources,
	PackageFailure,
	type PackageJob,
	PackageJobStatus,
	PackageReason,
} from "./offline-packages.types";
import { OfflinePackagesWorker } from "./offline-packages.worker";

describe("CTMS-052 worker and dependency wiring", () => {
	const job: PackageJob = {
		id: "job",
		trip_id: "trip",
		request_key: "initial",
		status: PackageJobStatus.GENERATING,
		attempts: 1,
		lease_token: "lease",
		lease_until: new Date(),
		created_at: new Date(),
		generation_started_at: new Date(),
		reason_codes: [],
		package_id: null,
	};
	const jobs = { claim: jest.fn(), heartbeat: jest.fn().mockResolvedValue(true), fail: jest.fn() };
	const packages = { generate: jest.fn(), cleanupOrphans: jest.fn() };
	const worker = new OfflinePackagesWorker(
		new ConfigService({ OFFLINE_PACKAGE_WORKER_ENABLED: "false" }),
		jobs as unknown as OfflinePackagesRepository,
		packages as unknown as OfflinePackagesService
	);
	beforeEach(() => {
		jest.clearAllMocks();
		jobs.claim.mockResolvedValue(job);
		packages.generate.mockResolvedValue(undefined);
	});
	it("awaits durable completion", async () => {
		await expect(worker.processOne()).resolves.toBe(true);
		expect(packages.generate).toHaveBeenCalledWith(job);
		expect(jobs.fail).not.toHaveBeenCalled();
	});
	it("records business blockers without publishing", async () => {
		const error = new PackageFailure([PackageReason.GUIDANCE_APPROVAL_UNAVAILABLE]);
		packages.generate.mockRejectedValue(error);
		await worker.processOne();
		expect(jobs.fail).toHaveBeenCalledWith(job, error);
	});
	it("makes technical failures retryable", async () => {
		packages.generate.mockRejectedValue(new Error("storage interrupted"));
		await worker.processOne();
		expect(jobs.fail).toHaveBeenCalledWith(
			job,
			expect.objectContaining({ reasons: [PackageReason.GENERATION_FAILED], retryable: true })
		);
	});
	it("does no generation with an empty queue", async () => {
		jobs.claim.mockResolvedValue(null);
		await expect(worker.processOne()).resolves.toBe(false);
		expect(packages.generate).not.toHaveBeenCalled();
	});
	it("prevents overlapping ticks and drains on shutdown", async () => {
		let finish: () => void = () => undefined;
		packages.generate.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				})
		);
		const first = worker.tick();
		await Promise.resolve();
		await worker.tick();
		expect(packages.generate).toHaveBeenCalledTimes(1);
		finish();
		await first;
		await worker.onModuleDestroy();
		expect(packages.cleanupOrphans).toHaveBeenCalledTimes(1);
	});
	it("resolves real Nest constructor dependencies and keeps production sources blocked", async () => {
		const module = await Test.createTestingModule({ imports: [OfflinePackagesModule] })
			.useMocker((token) => {
				if (token === DataSource) return {};
				if (token === ConfigService)
					return new ConfigService({ OFFLINE_PACKAGE_WORKER_ENABLED: "false" });
				return undefined;
			})
			.compile();
		expect(module.get(OfflinePackagesService)).toBeInstanceOf(OfflinePackagesService);
		const source = module.get(OfflineSafetySources);
		const read = await source.read({} as never, {} as never, false);
		expect(read.blockers).toEqual(
			expect.arrayContaining([
				PackageReason.HAZARD_FEED_UNAVAILABLE,
				PackageReason.GUIDANCE_APPROVAL_UNAVAILABLE,
				PackageReason.GUIDANCE_POLICY_UNAVAILABLE,
			])
		);
		await module.close();
	});
});
