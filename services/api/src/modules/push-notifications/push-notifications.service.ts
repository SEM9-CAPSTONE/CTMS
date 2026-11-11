import { Inject, Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { ConfigService } from "@nestjs/config";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
import { UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { UsersRepository } from "../users/users.repository";
import { pushIntentsForEvent } from "./push-notification.policy";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { PushNotificationsRepository } from "./push-notifications.repository";
import {
	PUSH_PREFERENCES,
	PUSH_SENDER,
	type PushDevice,
	type PushNotificationRow,
	type PushPlatform,
	type PushPreferenceSource,
	type PushSender,
	PushSkipReason,
} from "./push-notifications.types";

const DEFAULT_MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 60_000;
const TRIP_TEAM_MEMBER_STATUSES: ReadonlySet<BookingMemberStatus> = new Set([
	BookingMemberStatus.REGISTERED,
	BookingMemberStatus.JOINED,
]);

/** Delay before attempt `attempts + 1`: 1, 2, 4, 8 … minutes (BR-198). */
export function pushRetryDelayMs(attempts: number): number {
	return RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1);
}

export interface PushDeliveryReport {
	claimed: number;
	sent: number;
	skipped: number;
	retried: number;
	failed: number;
}

/**
 * CTMS-090: queues background pushes for committed events and delivers them.
 *
 * Queueing never throws into the business flow (BR-194). Delivery re-checks that the recipient may
 * still see the event, honours ordinary preferences but never mandatory safety alerts (BR-196),
 * records every outcome without assuming success (BR-197) and retries with a bounded backoff
 * (BR-198). Delivery state lives only in `push_notifications`.
 */
@Injectable()
export class PushNotificationsService {
	private readonly logger = new Logger(PushNotificationsService.name);

	constructor(
		private readonly repository: PushNotificationsRepository,
		private readonly users: UsersRepository,
		private readonly participation: GpsParticipationSource,
		private readonly configService: ConfigService,
		@Inject(PUSH_SENDER) private readonly sender: PushSender,
		@Inject(PUSH_PREFERENCES) private readonly preferences: PushPreferenceSource
	) {}

	registerDevice(userId: string, token: string, platform: PushPlatform): Promise<PushDevice> {
		return this.repository.upsertDevice(userId, token, platform);
	}

	unregisterDevice(userId: string, token: string): Promise<boolean> {
		return this.repository.deleteDevice(userId, token);
	}

	/**
	 * Queues the pushes of one committed realtime event. Safe to call twice for the same event;
	 * failures are logged and never reach the caller.
	 */
	async enqueueForEvent(
		name: string,
		payload: unknown,
		userIds: readonly string[],
		eventId: string
	): Promise<number> {
		try {
			const intents = pushIntentsForEvent(name, payload, userIds, eventId);
			return await this.repository.enqueue(intents);
		} catch (error) {
			this.logger.warn(`Push not queued for ${name} ${eventId}: ${describe(error)}`);
			return 0;
		}
	}

	/** One delivery pass over due pushes. */
	async deliverDue(now: Date = new Date(), batchSize = 50): Promise<PushDeliveryReport> {
		const rows = await this.repository.claimDue(now, batchSize);
		const report: PushDeliveryReport = {
			claimed: rows.length,
			sent: 0,
			skipped: 0,
			retried: 0,
			failed: 0,
		};
		for (const row of rows) {
			const outcome = await this.deliver(row, now).catch(async (error: unknown) => {
				await this.failAttempt(row, `Unexpected delivery error: ${describe(error)}`, now);
				return row.attempts >= this.maxAttempts() ? "failed" : "retried";
			});
			report[outcome] += 1;
		}
		return report;
	}

	private async deliver(
		row: PushNotificationRow,
		now: Date
	): Promise<"sent" | "skipped" | "retried" | "failed"> {
		if (!this.sender.configured) {
			await this.repository.markSkipped(row.id, PushSkipReason.PROVIDER_NOT_CONFIGURED, now);
			return "skipped";
		}
		if (!(await this.isEligible(row))) {
			await this.repository.markSkipped(row.id, PushSkipReason.NOT_ELIGIBLE, now);
			return "skipped";
		}
		if (!row.mandatory && !(await this.preferences.allows(row.recipientId, row.category))) {
			await this.repository.markSkipped(row.id, PushSkipReason.PREFERENCE_OFF, now);
			return "skipped";
		}
		const devices = await this.repository.activeDevices(row.recipientId);
		if (devices.length === 0) {
			await this.repository.markSkipped(row.id, PushSkipReason.NO_DEVICE, now);
			return "skipped";
		}

		let delivered = false;
		let retryableError: string | null = null;
		let permanentError: string | null = null;
		for (const device of devices) {
			const result = await this.sender.send({
				token: device.token,
				title: row.title,
				body: row.body,
				data: { ...row.data, pushId: row.id },
				highPriority: row.mandatory,
			});
			if (result.ok) {
				delivered = true;
			} else if (result.unregistered) {
				await this.repository.disableDevice(device.id);
			} else if (result.retryable) {
				retryableError = result.error;
			} else {
				permanentError = result.error;
			}
		}

		if (delivered) {
			await this.repository.markSent(row.id, now);
			return "sent";
		}
		if (retryableError) return this.failAttempt(row, retryableError, now);
		if (permanentError) {
			await this.repository.markAttemptFailed(row.id, permanentError, null, now);
			return "failed";
		}
		// Every device turned out to be unregistered.
		await this.repository.markSkipped(row.id, PushSkipReason.NO_DEVICE, now);
		return "skipped";
	}

	private async failAttempt(
		row: PushNotificationRow,
		error: string,
		now: Date
	): Promise<"retried" | "failed"> {
		if (row.attempts >= this.maxAttempts()) {
			await this.repository.markAttemptFailed(row.id, error, null, now);
			return "failed";
		}
		const retryAt = new Date(now.getTime() + pushRetryDelayMs(row.attempts));
		await this.repository.markAttemptFailed(row.id, error, retryAt, now);
		return "retried";
	}

	/** AC-5/PB AC-6: the account is active and, for Trip events, still in the Trip team. */
	private async isEligible(row: PushNotificationRow): Promise<boolean> {
		const user = await this.users.findOneWithRolesById(row.recipientId);
		if (!user || user.status !== UserStatus.ACTIVE) return false;
		if (!row.tripScoped || !row.tripId) return true;

		const trip = await this.participation.findTrip(row.tripId);
		if (!trip) return false;
		if (trip.hostId === row.recipientId) return true;
		const [camper, porter] = await Promise.all([
			this.participation.findCamperParticipation(row.tripId, row.recipientId),
			this.participation.findPorterAssignment(row.tripId, row.recipientId),
		]);
		if (camper && TRIP_TEAM_MEMBER_STATUSES.has(camper.memberStatus)) return true;
		return Boolean(porter?.assigned);
	}

	private maxAttempts(): number {
		const value = Number(this.configService.get<string>("PUSH_DELIVERY_MAX_ATTEMPTS"));
		return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_ATTEMPTS;
	}
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
