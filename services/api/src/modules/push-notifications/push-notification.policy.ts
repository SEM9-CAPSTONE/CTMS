import { PushCategory, type PushIntent } from "./push-notifications.types";

/** Realtime event names that may become a background push (BR-273). */
export const PUSHABLE_EVENTS = new Set([
	"booking.updated",
	"porter.request.created",
	"porter.request.state_changed",
	"trip.weather.changed",
	"trip.weather.decision_required",
	"sos.created",
	"sos.state_changed",
	"emergency.broadcast",
]);

const RISK_LABELS: Record<string, string> = { green: "Xanh", yellow: "Vàng", red: "Đỏ" };

const BOOKING_MESSAGES: Record<string, { title: string; body: (trip: string) => string }> = {
	confirmed: {
		title: "Đặt chỗ đã được xác nhận",
		body: (trip) => `Đơn đặt chỗ cho "${trip}" đã được xác nhận.`,
	},
	cancelled: {
		title: "Đơn đặt chỗ đã bị huỷ",
		body: (trip) => `Đơn đặt chỗ cho "${trip}" đã bị huỷ. Mở ứng dụng để xem chi tiết hoàn tiền.`,
	},
	expired: {
		title: "Giữ chỗ đã hết hạn",
		body: (trip) => `Giữ chỗ cho "${trip}" đã hết hạn vì chưa thanh toán.`,
	},
	pending_reconfirmation: {
		title: "Chuyến đi đã đổi lịch",
		body: (trip) => `"${trip}" đã đổi lịch. Vui lòng mở ứng dụng để xác nhận lại đơn đặt chỗ.`,
	},
};

const PORTER_STATE_MESSAGES: Record<string, { toHost: boolean; title: string; body: string }> = {
	accepted: {
		toHost: true,
		title: "Porter đã nhận lời",
		body: "Porter đã chấp nhận lời mời tham gia chuyến đi của bạn.",
	},
	declined: {
		toHost: true,
		title: "Porter đã từ chối",
		body: "Porter đã từ chối lời mời. Bạn có thể mời Porter khác.",
	},
	expired: {
		toHost: true,
		title: "Lời mời Porter đã hết hạn",
		body: "Porter chưa trả lời lời mời trước hạn. Bạn có thể mời Porter khác.",
	},
	cancelled: {
		toHost: false,
		title: "Lời mời đã bị huỷ",
		body: "Host đã huỷ lời mời tham gia chuyến đi.",
	},
};

/** SOS state changes worth a push: to the sender when the Host acts, to the Host when cancelled. */
const SOS_STATE_MESSAGES: Record<string, { toSender: boolean; body: string }> = {
	acknowledged: { toSender: true, body: "Host đã tiếp nhận yêu cầu cứu trợ của bạn." },
	closed: { toSender: true, body: "Yêu cầu cứu trợ của bạn đã được đóng." },
	cancelled: { toSender: false, body: "Người gửi đã huỷ yêu cầu cứu trợ." },
};

type Payload = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function truncate(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function intent(
	eventKey: string,
	recipientId: string,
	fields: Omit<PushIntent, "eventKey" | "recipientId">
): PushIntent {
	return {
		eventKey,
		recipientId,
		...fields,
		title: truncate(fields.title, 120),
		body: truncate(fields.body, 500),
	};
}

/**
 * CTMS-090: which pushes a committed realtime event creates, for whom and with which text.
 * Only users addressed by id are pushed (never a whole role); the stable event id makes a second
 * processing of the same event a no-op (BR-195). The push text is a hint; the app reloads the
 * authoritative state when it is opened.
 */
export function pushIntentsForEvent(
	name: string,
	payload: unknown,
	userIds: readonly string[],
	eventId: string
): PushIntent[] {
	if (!PUSHABLE_EVENTS.has(name) || !payload || typeof payload !== "object") return [];
	const p = payload as Payload;
	const key = `rt:${eventId}`;
	const tripId = text(p.tripId) || null;
	const baseData = (type: string): Record<string, string> => ({
		type,
		eventId,
		...(tripId ? { tripId } : {}),
	});
	const recipients = [...new Set(userIds)];

	switch (name) {
		case "booking.updated": {
			const message = BOOKING_MESSAGES[text(p.status)];
			if (!message) return [];
			const trip = text(p.tripTitle, "chuyến đi");
			return recipients.map((userId) =>
				intent(key, userId, {
					category: PushCategory.BOOKING,
					mandatory: false,
					tripId,
					tripScoped: false,
					title: message.title,
					body: message.body(trip),
					data: { ...baseData(name), bookingId: text(p.bookingId), status: text(p.status) },
				})
			);
		}
		case "porter.request.created":
			return [text(p.porterId)].filter(Boolean).map((porterId) =>
				intent(key, porterId, {
					category: PushCategory.PORTER_ASSIGNMENT,
					mandatory: false,
					tripId,
					tripScoped: false,
					title: "Lời mời làm Porter mới",
					body: "Bạn có lời mời tham gia một chuyến đi. Mở ứng dụng để xem và trả lời.",
					data: { ...baseData(name), requestId: text(p.requestId) },
				})
			);
		case "porter.request.state_changed": {
			const message = PORTER_STATE_MESSAGES[text(p.status)];
			if (!message) return [];
			const recipient = message.toHost ? text(p.requestedBy) : text(p.porterId);
			if (!recipient) return [];
			return [
				intent(key, recipient, {
					category: PushCategory.PORTER_ASSIGNMENT,
					mandatory: false,
					tripId,
					tripScoped: false,
					title: message.title,
					body: message.body,
					data: { ...baseData(name), requestId: text(p.requestId), status: text(p.status) },
				}),
			];
		}
		case "trip.weather.changed": {
			const level = text(p.riskLevel);
			const from = RISK_LABELS[text(p.previousRiskLevel)] ?? text(p.previousRiskLevel);
			const to = RISK_LABELS[level] ?? level;
			return recipients.map((userId) =>
				intent(key, userId, {
					category: PushCategory.WEATHER,
					// A Red forecast for the user's own Trip is a safety alert (BR-196).
					mandatory: level === "red",
					tripId,
					tripScoped: true,
					title: level === "red" ? "Cảnh báo thời tiết nguy hiểm" : "Dự báo thời tiết thay đổi",
					body: `${text(p.tripTitle, "Chuyến đi")}: mức rủi ro chuyển từ ${from} sang ${to}.`,
					data: { ...baseData(name), riskLevel: level },
				})
			);
		}
		case "trip.weather.decision_required":
			return recipients.map((userId) =>
				intent(key, userId, {
					category: PushCategory.WEATHER,
					mandatory: false,
					tripId,
					tripScoped: false,
					title: "Cần quyết định vì thời tiết",
					body: text(p.message, `${text(p.tripTitle, "Chuyến đi")} cần quyết định vì thời tiết.`),
					data: { ...baseData(name), urgency: text(p.urgency) },
				})
			);
		case "sos.created":
			return recipients.map((userId) =>
				intent(key, userId, {
					category: PushCategory.SOS,
					mandatory: true,
					tripId,
					tripScoped: false,
					title: "SOS khẩn cấp",
					body: "Có yêu cầu cứu trợ khẩn cấp trong chuyến đi của bạn. Mở ứng dụng ngay.",
					data: { ...baseData(name), sosId: text(p.sosId) },
				})
			);
		case "sos.state_changed": {
			const message = SOS_STATE_MESSAGES[text(p.status)];
			if (!message) return [];
			const sender = text(p.senderId);
			const targets = message.toSender
				? [sender].filter(Boolean)
				: recipients.filter((userId) => userId !== sender);
			return targets.map((userId) =>
				intent(key, userId, {
					category: PushCategory.SOS,
					mandatory: true,
					tripId,
					tripScoped: false,
					title: "Cập nhật yêu cầu cứu trợ",
					body: message.body,
					data: { ...baseData(name), sosId: text(p.sosId), status: text(p.status) },
				})
			);
		}
		case "emergency.broadcast": {
			const hostId = text(p.hostId);
			return recipients
				.filter((userId) => userId !== hostId)
				.map((userId) =>
					intent(key, userId, {
						category: PushCategory.EMERGENCY,
						mandatory: true,
						tripId,
						tripScoped: true,
						title: `Cảnh báo khẩn: ${text(p.tripTitle, "chuyến đi")}`,
						body: text(p.content, "Host vừa phát cảnh báo khẩn. Mở ứng dụng ngay."),
						data: { ...baseData(name), broadcastId: text(p.broadcastId) },
					})
				);
		}
		default:
			return [];
	}
}
