import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
// biome-ignore lint/style/useImportType: Nest injection
import { UploadsService } from "../../uploads/uploads.service";

/** Durable cleanup also receives rows from ON DELETE CASCADE when any caller deletes a Trip. */
@Injectable()
export class TripImageCleanupWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(TripImageCleanupWorker.name);
	private timer?: ReturnType<typeof setInterval>;
	private active: Promise<void> | null = null;
	constructor(
		private readonly db: DataSource,
		private readonly uploads: UploadsService
	) {}
	onApplicationBootstrap(): void {
		this.timer = setInterval(() => this.start(), 30_000);
		this.timer.unref();
		this.start();
	}
	async onApplicationShutdown(): Promise<void> {
		clearInterval(this.timer);
		await this.active;
	}
	private start(): void {
		if (this.active) return;
		this.active = this.tick()
			.catch((e) => this.logger.error("Trip image cleanup failed", e))
			.finally(() => {
				this.active = null;
			});
	}
	async tick(): Promise<void> {
		await this.db.transaction(async (m) => {
			const rows: { id: string; url: string; storage_key: string | null }[] = await m.query(
				"SELECT * FROM trip_image_cleanup WHERE next_attempt_at <= now() ORDER BY next_attempt_at LIMIT 20 FOR UPDATE SKIP LOCKED"
			);
			for (const row of rows) {
				try {
					await this.uploads.deleteStoredImage(row.url, row.storage_key);
					await m.query("DELETE FROM trip_image_cleanup WHERE id=$1", [row.id]);
				} catch {
					await m.query(
						"UPDATE trip_image_cleanup SET attempts=attempts+1,next_attempt_at=now()+interval '5 minutes' WHERE id=$1",
						[row.id]
					);
					this.logger.warn(`Retrying Trip image cleanup ${row.id}`);
				}
			}
		});
	}
}
