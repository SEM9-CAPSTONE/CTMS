import { createVerify, generateKeyPairSync } from "node:crypto";
import { publishBookingUpdates, stableEventId } from "../realtime/booking-updates";
import type { EventsGateway } from "../realtime/events.gateway";
import { FcmPushSender, UnconfiguredPushSender, signServiceAccountJwt } from "./fcm-push.sender";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const credentials = {
	projectId: "ctms-test",
	clientEmail: "push@ctms-test.iam.gserviceaccount.com",
	// As written in an env file, with escaped new lines.
	privateKey: PEM.replace(/\n/g, "\\n"),
};
const NOW = new Date("2026-11-11T10:00:00.000Z");
const message = {
	token: "device-token",
	title: "SOS",
	body: "Mở ứng dụng",
	data: { type: "sos.created" },
	highPriority: true,
};

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function fakeFetch(...sendResponses: Array<Response | Error>) {
	return jest.fn(async (url: string) => {
		if (url.startsWith("https://oauth2.googleapis.com")) {
			return json(200, { access_token: "oauth-token", expires_in: 3600 });
		}
		const next = sendResponses.shift() ?? json(200, { name: "projects/x/messages/1" });
		if (next instanceof Error) throw next;
		return next;
	});
}

describe("FCM HTTP v1 sender (CTMS-090 technical design)", () => {
	it("signs a valid RS256 service-account assertion", () => {
		const jwt = signServiceAccountJwt(credentials, NOW);
		const [header, claims, signature] = jwt.split(".");
		const verifier = createVerify("RSA-SHA256");
		verifier.update(`${header}.${claims}`);
		expect(verifier.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
		expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
			iss: credentials.clientEmail,
			scope: "https://www.googleapis.com/auth/firebase.messaging",
			aud: "https://oauth2.googleapis.com/token",
			iat: NOW.getTime() / 1000,
			exp: NOW.getTime() / 1000 + 3600,
		});
	});

	it("sends a high-priority message and reuses the OAuth token", async () => {
		const fetchImpl = fakeFetch();
		const sender = new FcmPushSender(credentials, fetchImpl, () => NOW);
		await expect(sender.send(message)).resolves.toEqual({ ok: true });
		await expect(sender.send(message)).resolves.toEqual({ ok: true });

		const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
		expect(calls.filter(([url]) => url.includes("oauth2"))).toHaveLength(1);
		const [url, init] = calls[1];
		expect(url).toBe("https://fcm.googleapis.com/v1/projects/ctms-test/messages:send");
		expect((init.headers as Record<string, string>).Authorization).toBe("Bearer oauth-token");
		expect(JSON.parse(init.body as string)).toEqual({
			message: {
				token: "device-token",
				notification: { title: "SOS", body: "Mở ứng dụng" },
				data: { type: "sos.created" },
				android: { priority: "HIGH" },
				apns: { headers: { "apns-priority": "10" } },
			},
		});
	});

	it("reports an unregistered token so the device can be disabled", async () => {
		const sender = new FcmPushSender(
			credentials,
			fakeFetch(
				json(404, { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } })
			),
			() => NOW
		);
		await expect(sender.send(message)).resolves.toEqual({
			ok: false,
			unregistered: true,
			error: "FCM 404 UNREGISTERED",
		});
	});

	it.each([
		["503", json(503, { error: { status: "UNAVAILABLE" } }), true],
		["429", json(429, { error: { status: "RESOURCE_EXHAUSTED" } }), true],
		["a timeout", new Error("The operation was aborted due to timeout"), true],
		["400", json(400, { error: { status: "INVALID_ARGUMENT" } }), false],
	])(
		"never reports success on %s and says whether a retry can help",
		async (_case, response, retryable) => {
			const sender = new FcmPushSender(credentials, fakeFetch(response), () => NOW);
			await expect(sender.send(message)).resolves.toEqual(
				expect.objectContaining({ ok: false, unregistered: false, retryable })
			);
		}
	);

	it("is retryable when the OAuth token cannot be obtained", async () => {
		const fetchImpl = jest.fn(async () => json(401, { error: "invalid_grant" }));
		const sender = new FcmPushSender(credentials, fetchImpl, () => NOW);
		await expect(sender.send(message)).resolves.toEqual(
			expect.objectContaining({ ok: false, retryable: true })
		);
	});

	it("does not pretend to send without a configured provider", async () => {
		const sender = new UnconfiguredPushSender();
		expect(sender.configured).toBe(false);
		await expect(sender.send()).resolves.toEqual(expect.objectContaining({ ok: false }));
	});
});

describe("booking update events (CTMS-090)", () => {
	it("derives the same UUID for the same occurrence and different ones otherwise", () => {
		const id = stableEventId("booking.updated", "confirmed", "b-1", "");
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(stableEventId("booking.updated", "confirmed", "b-1", "")).toBe(id);
		expect(stableEventId("booking.updated", "cancelled", "b-1", "")).not.toBe(id);
	});

	it("tells each owner once and never throws into the business flow", () => {
		const gateway = { emitBookingUpdated: jest.fn() };
		publishBookingUpdates(
			gateway as unknown as EventsGateway,
			"pending_reconfirmation",
			{ id: "t-1", title: "Bidoup" },
			[
				{ id: "b-1", userId: "u-1" },
				{ id: "b-2", userId: "u-2" },
			],
			"2026-11-11T00:00:00.000Z",
			NOW
		);
		expect(gateway.emitBookingUpdated).toHaveBeenCalledTimes(2);
		expect(gateway.emitBookingUpdated).toHaveBeenCalledWith("u-1", {
			eventId: stableEventId(
				"booking.updated",
				"pending_reconfirmation",
				"b-1",
				"2026-11-11T00:00:00.000Z"
			),
			bookingId: "b-1",
			tripId: "t-1",
			tripTitle: "Bidoup",
			status: "pending_reconfirmation",
			updatedAt: NOW.toISOString(),
		});

		gateway.emitBookingUpdated.mockImplementation(() => {
			throw new Error("socket down");
		});
		expect(() =>
			publishBookingUpdates(
				gateway as unknown as EventsGateway,
				"cancelled",
				{ id: "t", title: "T" },
				[{ id: "b", userId: "u" }]
			)
		).not.toThrow();
		expect(() =>
			publishBookingUpdates(undefined, "cancelled", { id: "t", title: "T" }, [])
		).not.toThrow();
	});
});
