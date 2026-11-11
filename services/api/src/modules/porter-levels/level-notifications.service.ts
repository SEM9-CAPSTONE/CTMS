import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource, type EntityManager } from "typeorm";
import type { LevelNotification } from "./level-requests.types";

@Injectable()
export class LevelNotificationsService implements OnModuleInit, OnModuleDestroy {
	private timer?: ReturnType<typeof setInterval>;
	private readonly logger = new Logger(LevelNotificationsService.name);
	constructor(private readonly db: DataSource) {}
	onModuleInit() {
		if (process.env.NODE_ENV !== "test")
			this.timer = setInterval(
				() =>
					void this.dispatch().catch(() =>
						this.logger.warn("Porter level notification delivery will be retried")
					),
				5000
			);
	}
	onModuleDestroy() {
		if (this.timer) clearInterval(this.timer);
	}
	async enqueue(
		manager: EntityManager,
		recipientId: string,
		payload: LevelNotification["payload"]
	): Promise<void> {
		await manager.query(
			"INSERT INTO porter_level_notification_outbox(recipient_id,payload) VALUES($1,$2::jsonb)",
			[recipientId, JSON.stringify(payload)]
		);
	}
	async dispatch(): Promise<void> {
		await this.db.transaction(async (manager) => {
			await manager.query(`WITH batch AS (SELECT * FROM porter_level_notification_outbox WHERE delivered_at IS NULL ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED),
			 inserted AS (INSERT INTO porter_level_notifications(id,recipient_id,payload,created_at) SELECT id,recipient_id,payload,created_at FROM batch ON CONFLICT(id) DO NOTHING)
			 UPDATE porter_level_notification_outbox SET delivered_at=now() WHERE id IN (SELECT id FROM batch)`);
		});
	}
	list(porterId: string): Promise<LevelNotification[]> {
		return this.db.query(
			`SELECT id,payload,created_at AS "createdAt",read_at AS "readAt" FROM porter_level_notifications WHERE recipient_id=$1 ORDER BY created_at DESC LIMIT 50`,
			[porterId]
		);
	}
	async read(porterId: string, id: string): Promise<void> {
		await this.db.query(
			"UPDATE porter_level_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND recipient_id=$2",
			[id, porterId]
		);
	}
}
