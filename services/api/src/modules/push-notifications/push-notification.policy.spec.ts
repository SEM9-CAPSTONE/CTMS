import { pushIntentsForEvent } from "./push-notification.policy";
import { PushCategory } from "./push-notifications.types";

const EVENT = "11111111-1111-4111-8111-111111111111";
const TRIP = "22222222-2222-4222-8222-222222222222";
const HOST = "33333333-3333-4333-8333-333333333333";
const CAMPER = "44444444-4444-4444-8444-444444444444";
const PORTER = "55555555-5555-4555-8555-555555555555";

describe("pushIntentsForEvent (CTMS-090, BR-273)", () => {
	it("pushes a Booking update to its owner with routing data only", () => {
		const [intent, ...rest] = pushIntentsForEvent(
			"booking.updated",
			{ bookingId: "b-1", tripId: TRIP, tripTitle: "Tà Năng", status: "pending_reconfirmation" },
			[CAMPER, CAMPER],
			EVENT
		);
		expect(rest).toEqual([]);
		expect(intent).toEqual({
			eventKey: `rt:${EVENT}`,
			recipientId: CAMPER,
			category: PushCategory.BOOKING,
			mandatory: false,
			tripId: TRIP,
			tripScoped: false,
			title: "Chuyến đi đã đổi lịch",
			body: '"Tà Năng" đã đổi lịch. Vui lòng mở ứng dụng để xác nhận lại đơn đặt chỗ.',
			data: {
				type: "booking.updated",
				eventId: EVENT,
				tripId: TRIP,
				bookingId: "b-1",
				status: "pending_reconfirmation",
			},
		});
	});

	it.each(["confirmed", "cancelled", "expired"])("supports the Booking status %s", (status) => {
		expect(
			pushIntentsForEvent("booking.updated", { status, tripId: TRIP }, [CAMPER], EVENT)
		).toHaveLength(1);
	});

	it("ignores Booking statuses that are not pushed", () => {
		expect(
			pushIntentsForEvent("booking.updated", { status: "completed" }, [CAMPER], EVENT)
		).toEqual([]);
	});

	it("pushes a new Porter request to the Porter and its answer to the requesting Host", () => {
		const created = pushIntentsForEvent(
			"porter.request.created",
			{ requestId: "r", tripId: TRIP, porterId: PORTER, requestedBy: HOST },
			[PORTER, HOST],
			EVENT
		);
		expect(created.map((item) => [item.recipientId, item.category])).toEqual([
			[PORTER, PushCategory.PORTER_ASSIGNMENT],
		]);

		const accepted = pushIntentsForEvent(
			"porter.request.state_changed",
			{ requestId: "r", tripId: TRIP, porterId: PORTER, requestedBy: HOST, status: "accepted" },
			[PORTER, HOST],
			EVENT
		);
		expect(accepted.map((item) => [item.recipientId, item.title])).toEqual([
			[HOST, "Porter đã nhận lời"],
		]);

		const cancelled = pushIntentsForEvent(
			"porter.request.state_changed",
			{ requestId: "r", porterId: PORTER, requestedBy: HOST, status: "cancelled" },
			[PORTER, HOST],
			EVENT
		);
		expect(cancelled.map((item) => item.recipientId)).toEqual([PORTER]);
		expect(
			pushIntentsForEvent(
				"porter.request.state_changed",
				{ porterId: PORTER, requestedBy: HOST, status: "pending" },
				[PORTER, HOST],
				EVENT
			)
		).toEqual([]);
	});

	it("makes a Red forecast a mandatory Trip-scoped safety alert", () => {
		const intents = pushIntentsForEvent(
			"trip.weather.changed",
			{ tripId: TRIP, tripTitle: "Bidoup", previousRiskLevel: "yellow", riskLevel: "red" },
			[HOST, CAMPER],
			EVENT
		);
		expect(intents).toHaveLength(2);
		expect(intents[1]).toMatchObject({
			recipientId: CAMPER,
			category: PushCategory.WEATHER,
			mandatory: true,
			tripScoped: true,
			title: "Cảnh báo thời tiết nguy hiểm",
			body: "Bidoup: mức rủi ro chuyển từ Vàng sang Đỏ.",
		});
		const easing = pushIntentsForEvent(
			"trip.weather.changed",
			{ tripId: TRIP, previousRiskLevel: "red", riskLevel: "yellow" },
			[CAMPER],
			EVENT
		);
		expect(easing[0].mandatory).toBe(false);
	});

	it("uses the server text of a weather decision reminder", () => {
		const [intent] = pushIntentsForEvent(
			"trip.weather.decision_required",
			{ tripId: TRIP, message: "Còn 24 giờ để quyết định.", urgency: "urgent" },
			[HOST],
			EVENT
		);
		expect(intent).toMatchObject({
			body: "Còn 24 giờ để quyết định.",
			mandatory: false,
			data: expect.objectContaining({ urgency: "urgent" }),
		});
	});

	it("makes SOS pushes mandatory and routes state changes to the right side", () => {
		const [created] = pushIntentsForEvent(
			"sos.created",
			{ sosId: "s", tripId: TRIP, senderId: CAMPER },
			[HOST],
			EVENT
		);
		expect(created).toMatchObject({
			recipientId: HOST,
			category: PushCategory.SOS,
			mandatory: true,
		});

		const acknowledged = pushIntentsForEvent(
			"sos.state_changed",
			{ sosId: "s", tripId: TRIP, senderId: CAMPER, status: "acknowledged" },
			[HOST, CAMPER],
			EVENT
		);
		expect(acknowledged.map((item) => item.recipientId)).toEqual([CAMPER]);

		const cancelledBySender = pushIntentsForEvent(
			"sos.state_changed",
			{ sosId: "s", tripId: TRIP, senderId: CAMPER, status: "cancelled" },
			[HOST, CAMPER],
			EVENT
		);
		expect(cancelledBySender.map((item) => item.recipientId)).toEqual([HOST]);
	});

	it("pushes an emergency broadcast to the team but not back to the Host", () => {
		const intents = pushIntentsForEvent(
			"emergency.broadcast",
			{
				tripId: TRIP,
				tripTitle: "Bidoup",
				hostId: HOST,
				content: "Xuống núi ngay",
				broadcastId: "x",
			},
			[HOST, CAMPER, PORTER],
			EVENT
		);
		expect(intents.map((item) => item.recipientId)).toEqual([CAMPER, PORTER]);
		expect(intents[0]).toMatchObject({
			category: PushCategory.EMERGENCY,
			mandatory: true,
			tripScoped: true,
			title: "Cảnh báo khẩn: Bidoup",
			body: "Xuống núi ngay",
		});
	});

	it("never pushes role-wide or unsupported events, and trims long text", () => {
		expect(pushIntentsForEvent("trip.review.requested", { tripId: TRIP }, [HOST], EVENT)).toEqual(
			[]
		);
		expect(pushIntentsForEvent("sos.created", null, [HOST], EVENT)).toEqual([]);
		const [long] = pushIntentsForEvent(
			"emergency.broadcast",
			{ tripId: TRIP, hostId: HOST, content: "x".repeat(800) },
			[CAMPER],
			EVENT
		);
		expect(long.body).toHaveLength(500);
		expect(long.body.endsWith("…")).toBe(true);
	});
});
