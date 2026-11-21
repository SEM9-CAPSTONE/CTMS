import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { EventsGateway } from "../realtime/events.gateway";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { InAppNotificationsService } from "./in-app-notifications.service";

const DELIVERY_INTERVAL_MS = 1_000;
const DELIVERY_BATCH_SIZE = 20;

@Injectable()
export class InAppNotificationDeliveryWorker implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(InAppNotificationDeliveryWorker.name);
	private timer: NodeJS.Timeout | null = null;
	private running: Promise<void> | null = null;
	constructor(
		private readonly dataSource: DataSource,
		private readonly notifications: InAppNotificationsService,
		private readonly gateway: EventsGateway
	) {}
	onModuleInit(): void {
		if (
			process.env.NODE_ENV === "test" ||
			process.env.IN_APP_NOTIFICATION_WORKER_ENABLED === "false"
		)
			return;
		this.timer = setInterval(() => {
			void this.runOnce();
		}, DELIVERY_INTERVAL_MS);
	}
	async onModuleDestroy(): Promise<void> {
		if (this.timer) clearInterval(this.timer);
		await this.running;
	}
	runOnce(): Promise<void> {
		if (this.running) return this.running;
		this.running = this.deliverBatch()
			.catch((error: unknown) => {
				this.logger.error(
					"In-app notification delivery failed; pending rows will be retried",
					error
				);
			})
			.finally(() => {
				this.running = null;
			});
		return this.running;
	}
	private async deliverBatch(): Promise<void> {
		for (let index = 0; index < DELIVERY_BATCH_SIZE; index += 1) {
			const found = await this.dataSource.transaction(async (manager) => {
				// A row lock prevents competing instances from delivering the same row concurrently.
				const rows: { id: string; recipient_id: string }[] = await manager.query(
					`SELECT id, recipient_id FROM in_app_notifications WHERE delivered_at IS NULL
					 ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`
				);
				const row = rows[0];
				if (!row) return false;
				const view = await this.notifications.findForDelivery(manager, row.id);
				if (view) await this.gateway.emitInAppNotification(row.recipient_id, view);
				await manager.query("UPDATE in_app_notifications SET delivered_at = now() WHERE id = $1", [
					row.id,
				]);
				return true;
			});
			if (!found) break;
		}
	}
}
