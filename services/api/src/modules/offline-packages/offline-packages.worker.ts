import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection
import { OfflinePackagesRepository } from "./offline-packages.repository";
// biome-ignore lint/style/useImportType: Nest injection
import { OfflinePackagesService } from "./offline-packages.service";
import { LEASE_SECONDS, POLL_MS, PackageFailure, PackageReason } from "./offline-packages.types";

@Injectable()
export class OfflinePackagesWorker implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(OfflinePackagesWorker.name);
	private timer?: NodeJS.Timeout;
	private active: Promise<void> | null = null;
	private stopping = false;
	constructor(
		private readonly config: ConfigService,
		private readonly jobs: OfflinePackagesRepository,
		private readonly packages: OfflinePackagesService
	) {}
	onModuleInit(): void {
		const enabled =
			this.config.get<string>("OFFLINE_PACKAGE_WORKER_ENABLED") ??
			(process.env.NODE_ENV === "test" ? "false" : "true");
		if (enabled !== "true") return;
		this.timer = setInterval(() => void this.tick(), POLL_MS);
		this.timer.unref();
		void this.tick();
	}
	async onModuleDestroy(): Promise<void> {
		this.stopping = true;
		if (this.timer) clearInterval(this.timer);
		await this.active;
	}
	async tick(): Promise<void> {
		if (this.stopping || this.active) return;
		this.active = this.runTick()
			.catch(() => {
				this.logger.error(
					"Offline package worker failed; durable leases will recover unfinished work"
				);
			})
			.finally(() => {
				this.active = null;
			});
		await this.active;
	}
	private async runTick(): Promise<void> {
		await this.processOne();
		await this.packages.cleanupOrphans();
	}
	async processOne(): Promise<boolean> {
		const job = await this.jobs.claim();
		if (!job) return false;
		const started = Date.now();
		const heartbeat = setInterval(
			() => {
				void this.jobs.heartbeat(job).catch(() => false);
			},
			(LEASE_SECONDS * 1000) / 3
		);
		heartbeat.unref();
		try {
			await this.packages.generate(job);
			this.logger.log(
				JSON.stringify({
					event: "offline_package_ready",
					jobId: job.id,
					attempt: job.attempts,
					durationMs: Date.now() - started,
				})
			);
		} catch (error) {
			const failure =
				error instanceof PackageFailure
					? error
					: new PackageFailure([PackageReason.GENERATION_FAILED], true);
			await this.jobs.fail(job, failure);
			this.logger.warn(
				JSON.stringify({
					event: "offline_package_attempt_failed",
					jobId: job.id,
					attempt: job.attempts,
					reasonCodes: failure.reasons,
					durationMs: Date.now() - started,
				})
			);
		} finally {
			clearInterval(heartbeat);
		}
		return true;
	}
}
