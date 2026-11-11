/** CTMS-090 / BR-273: event categories that may be pushed while the app runs in the background. */
export enum PushCategory {
	BOOKING = "booking",
	PORTER_ASSIGNMENT = "porter_assignment",
	WEATHER = "weather",
	SOS = "sos",
	/** Host emergency broadcast to a Trip (CTMS-081): a safety alert, never suppressible. */
	EMERGENCY = "emergency",
}

export enum PushStatus {
	PENDING = "pending",
	/** Claimed by a delivery pass; a crashed pass is retried after `STALE_SENDING_MS`. */
	SENDING = "sending",
	SENT = "sent",
	FAILED = "failed",
	SKIPPED = "skipped",
}

export enum PushSkipReason {
	NO_DEVICE = "no_device",
	NOT_ELIGIBLE = "not_eligible",
	PREFERENCE_OFF = "preference_off",
	PROVIDER_NOT_CONFIGURED = "provider_not_configured",
	INVALID_MESSAGE = "invalid_message",
}

export enum PushPlatform {
	ANDROID = "android",
	IOS = "ios",
}

/** One push to create for one recipient; `eventKey` + recipient is the duplicate guard. */
export interface PushIntent {
	eventKey: string;
	recipientId: string;
	category: PushCategory;
	/** Safety/emergency alerts the user cannot switch off (BR-196). */
	mandatory: boolean;
	tripId: string | null;
	/** Re-check at send time that the recipient still belongs to the Trip team. */
	tripScoped: boolean;
	title: string;
	body: string;
	/** Small routing hints for the app; never the authoritative state (spec Section 8). */
	data: Record<string, string>;
}

export interface PushNotificationRow {
	id: string;
	eventKey: string;
	recipientId: string;
	category: PushCategory;
	mandatory: boolean;
	tripId: string | null;
	tripScoped: boolean;
	title: string;
	body: string;
	data: Record<string, string>;
	status: PushStatus;
	attempts: number;
}

export interface PushDevice {
	id: string;
	userId: string;
	token: string;
	platform: PushPlatform;
}

/** Message handed to the push provider for one device. */
export interface PushMessage {
	token: string;
	title: string;
	body: string;
	data: Record<string, string>;
	highPriority: boolean;
}

export type PushSendResult =
	| { ok: true }
	/** The token is no longer valid (app removed / token rotated): disable the device. */
	| { ok: false; unregistered: true; error: string }
	/** `retryable` false: the message itself is rejected, retrying cannot help. */
	| { ok: false; unregistered: false; retryable: boolean; error: string };

/** Push provider (FCM in production, a fake in tests). */
export interface PushSender {
	readonly configured: boolean;
	send(message: PushMessage): Promise<PushSendResult>;
}

export const PUSH_SENDER = Symbol("PUSH_SENDER");

/**
 * CTMS-091 hook: whether a user wants ordinary pushes of a category. Mandatory safety alerts are
 * never asked (BR-196).
 */
export interface PushPreferenceSource {
	allows(userId: string, category: PushCategory): Promise<boolean>;
}

export const PUSH_PREFERENCES = Symbol("PUSH_PREFERENCES");
