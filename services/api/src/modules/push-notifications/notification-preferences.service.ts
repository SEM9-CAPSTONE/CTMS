import {
	ConflictException,
	Injectable,
	Logger,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource, type EntityManager } from "typeorm";
import { NOTIFICATION_PREFERENCE_CATALOG } from "./notification-preferences.catalog";
import type { PushCategory, PushPreferenceSource } from "./push-notifications.types";

export interface PreferenceChange {
	category: string;
	enabled: boolean;
}
interface PreferenceRow {
	user_id: string;
	category: string;
	enabled: boolean;
}

@Injectable()
export class NotificationPreferencesService implements PushPreferenceSource {
	private readonly logger = new Logger(NotificationPreferencesService.name);
	constructor(private readonly db: DataSource) {}

	async get(userId: string) {
		// One SQL snapshot keeps the version and preferences coherent during concurrent PATCHes.
		return this.read(this.db.manager, userId);
	}

	async patch(userId: string, expectedVersion: number, changes: PreferenceChange[]) {
		this.validate(expectedVersion, changes);
		return this.db.transaction(async (manager) => {
			await manager.query(
				`INSERT INTO notification_preference_versions(user_id) VALUES($1)
				ON CONFLICT(user_id) DO NOTHING`,
				[userId]
			);
			const versions: { version: number }[] = await manager.query(
				"SELECT version FROM notification_preference_versions WHERE user_id=$1 FOR UPDATE",
				[userId]
			);
			if (versions[0].version !== expectedVersion) {
				throw new ConflictException({
					code: "PREFERENCE_VERSION_CONFLICT",
					message: "Tùy chọn đã thay đổi. Vui lòng tải lại trước khi lưu.",
				});
			}
			await manager.query(
				`INSERT INTO notification_preferences(user_id,category,enabled)
				SELECT $1, item.category, item.enabled FROM jsonb_to_recordset($2::jsonb)
				AS item(category text, enabled boolean)
				ON CONFLICT(user_id,category) DO UPDATE SET enabled=EXCLUDED.enabled`,
				[userId, JSON.stringify(changes)]
			);
			await manager.query(
				"UPDATE notification_preference_versions SET version=version+1 WHERE user_id=$1",
				[userId]
			);
			return this.read(manager, userId);
		});
	}

	/** Fresh delivery-pass snapshot, never reused across batches or retry attempts. */
	async loadBatch(userIds: readonly string[]): Promise<PushPreferenceSource> {
		try {
			const rows: PreferenceRow[] = await this.db.query(
				"SELECT user_id,category,enabled FROM notification_preferences WHERE user_id=ANY($1::uuid[])",
				[[...new Set(userIds)]]
			);
			const disabled = new Set(
				rows.filter((row) => !row.enabled).map((row) => `${row.user_id}:${row.category}`)
			);
			return { allows: async (userId, category) => !disabled.has(`${userId}:${category}`) };
		} catch {
			this.logger.warn(
				"Push preference lookup failed; ordinary notifications remain enabled for this delivery pass"
			);
			return { allows: async () => true };
		}
	}

	async allows(userId: string, category: PushCategory): Promise<boolean> {
		return (await this.loadBatch([userId])).allows(userId, category);
	}

	private async read(manager: EntityManager, userId: string) {
		const rows: { version: number; preferences: Record<string, boolean> }[] = await manager.query(
			`
			SELECT COALESCE((SELECT version FROM notification_preference_versions WHERE user_id=$1),0) AS version,
			COALESCE((SELECT jsonb_object_agg(category,enabled) FROM notification_preferences WHERE user_id=$1),'{}'::jsonb) AS preferences`,
			[userId]
		);
		return {
			channel: "push" as const,
			version: rows[0].version,
			categories: NOTIFICATION_PREFERENCE_CATALOG.map((entry) => ({
				...entry,
				enabled: entry.configurable ? (rows[0].preferences[entry.category] ?? true) : true,
				effectiveEnabled: entry.configurable ? (rows[0].preferences[entry.category] ?? true) : true,
			})),
		};
	}

	private validate(version: number, changes: PreferenceChange[]) {
		if (
			!Number.isSafeInteger(version) ||
			version < 0 ||
			version >= 2_147_483_647 ||
			!Array.isArray(changes) ||
			changes.length < 1 ||
			changes.length > NOTIFICATION_PREFERENCE_CATALOG.length
		) {
			throw new UnprocessableEntityException({
				code: "INVALID_PREFERENCE_CHANGE",
				message: "Dữ liệu tùy chọn không hợp lệ.",
			});
		}
		const seen = new Set<string>();
		for (const change of changes) {
			const entry = NOTIFICATION_PREFERENCE_CATALOG.find(
				(item) => item.category === change?.category
			);
			if (!entry)
				throw new UnprocessableEntityException({
					code: "UNSUPPORTED_NOTIFICATION_TYPE",
					message: "Loại thông báo không được hỗ trợ.",
				});
			if (!entry.configurable)
				throw new UnprocessableEntityException({
					code: "MANDATORY_NOTIFICATION_TYPE",
					message: "Cảnh báo bắt buộc luôn được bật.",
				});
			if (typeof change.enabled !== "boolean" || seen.has(change.category)) {
				throw new UnprocessableEntityException({
					code: "INVALID_PREFERENCE_CHANGE",
					message: "Dữ liệu tùy chọn không hợp lệ.",
				});
			}
			seen.add(change.category);
		}
	}
}
