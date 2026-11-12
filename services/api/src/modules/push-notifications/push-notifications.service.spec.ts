import type { ConfigService } from "@nestjs/config";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
import { UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import { PushDeliveryWorker } from "./push-delivery.worker";
import type { PushNotificationsRepository } from "./push-notifications.repository";
import { PushNotificationsService, pushRetryDelayMs } from "./push-notifications.service";
import {
	PushCategory,
	type PushNotificationRow,
	type PushPreferenceSource,
	type PushSendResult,
	type PushSender,
	PushSkipReason,
	PushStatus,
} from "./push-notifications.types";

const NOW = new Date("2026-11-11T10:00:00.000Z");
const USER = "44444444-4444-4444-8444-444444444444";
const HOST = "33333333-3333-4333-8333-333333333333";
const TRIP = "22222222-2222-4222-8222-222222222222";

function row(overrides: Partial<PushNotificationRow> = {}): PushNotificationRow {
	return {
		id: "push-1",
		eventKey: "rt:e-1",
		recipientId: USER,
		category: PushCategory.BOOKING,
		mandatory: false,
		tripId: TRIP,
		tripScoped: false,
		title: "T",
		body: "B",
		data: { type: "booking.updated" },
		status: PushStatus.SENDING,
		attempts: 1,
		...overrides,
	};
}

function setup(
	options: {
		rows?: PushNotificationRow[];
		send?: (token: string) => PushSendResult;
		configured?: boolean;
		allows?: boolean;
		status?: UserStatus | null;
		devices?: string[];
		memberStatus?: BookingMemberStatus | null;
	} = {}
) {
	const repository = {
		claimDue: jest.fn().mockResolvedValue(options.rows ?? [row()]),
		activeDevices: jest.fn().mockResolvedValue(
			(options.devices ?? ["token-a"]).map((token, index) => ({
				id: `device-${index}`,
				userId: USER,
				token,
				platform: "android",
			}))
		),
		markSent: jest.fn().mockResolvedValue(undefined),
		markSkipped: jest.fn().mockResolvedValue(undefined),
		markAttemptFailed: jest.fn().mockResolvedValue(undefined),
		disableDevice: jest.fn().mockResolvedValue(undefined),
		enqueue: jest.fn().mockResolvedValue(1),
		upsertDevice: jest.fn(),
		deleteDevice: jest.fn(),
	};
	const users = {
		findOneWithRolesById: jest
			.fn()
			.mockResolvedValue(
				options.status === null ? null : { id: USER, status: options.status ?? UserStatus.ACTIVE }
			),
	};
	const participation = {
		findTrip: jest.fn().mockResolvedValue({ id: TRIP, hostId: HOST }),
		findCamperParticipation: jest
			.fn()
			.mockResolvedValue(
				options.memberStatus === null
					? null
					: { memberStatus: options.memberStatus ?? BookingMemberStatus.JOINED }
			),
		findPorterAssignment: jest.fn().mockResolvedValue(null),
	};
	const sender: PushSender & { send: jest.Mock } = {
		configured: options.configured ?? true,
		send: jest.fn(async ({ token }: { token: string }) => options.send?.(token) ?? { ok: true }),
	};
	const preferences: PushPreferenceSource & { allows: jest.Mock } = {
		allows: jest.fn().mockResolvedValue(options.allows ?? true),
	};
	const service = new PushNotificationsService(
		repository as unknown as PushNotificationsRepository,
		users as unknown as UsersRepository,
		participation as unknown as GpsParticipationSource,
		{ get: () => undefined } as unknown as ConfigService,
		sender,
		preferences
	);
	return { service, repository, sender, preferences, participation };
}

describe("PushNotificationsService (CTMS-090)", () => {
	describe("queueing", () => {
		it("queues the intents of a pushable event", async () => {
			const { service, repository } = setup();
			await expect(
				service.enqueueForEvent("sos.created", { sosId: "s", tripId: TRIP }, [HOST], "e-1")
			).resolves.toBe(1);
			expect(repository.enqueue).toHaveBeenCalledWith([
				expect.objectContaining({ eventKey: "rt:e-1", recipientId: HOST, mandatory: true }),
			]);
		});

		it("never throws into the business flow when queueing fails (BR-194)", async () => {
			const { service, repository } = setup();
			repository.enqueue.mockRejectedValueOnce(new Error("db down"));
			await expect(
				service.enqueueForEvent("sos.created", { sosId: "s" }, [HOST], "e-1")
			).resolves.toBe(0);
		});
	});

	describe("delivery", () => {
		it("sends to every active device and marks the push sent", async () => {
			const { service, repository, sender } = setup({ devices: ["a", "b"] });
			await expect(service.deliverDue(NOW)).resolves.toMatchObject({ claimed: 1, sent: 1 });
			expect(sender.send).toHaveBeenCalledTimes(2);
			expect(sender.send).toHaveBeenCalledWith({
				token: "a",
				title: "T",
				body: "B",
				data: { type: "booking.updated", pushId: "push-1" },
				highPriority: false,
			});
			expect(repository.markSent).toHaveBeenCalledWith("push-1", NOW);
		});

		it("records provider_not_configured instead of pretending success (BR-197)", async () => {
			const { service, repository, sender } = setup({ configured: false });
			await service.deliverDue(NOW);
			expect(sender.send).not.toHaveBeenCalled();
			expect(repository.markSkipped).toHaveBeenCalledWith(
				"push-1",
				PushSkipReason.PROVIDER_NOT_CONFIGURED,
				NOW
			);
			expect(repository.markSent).not.toHaveBeenCalled();
		});

		it("skips a recipient whose account is no longer active", async () => {
			const { service, repository } = setup({ status: UserStatus.SUSPENDED });
			await service.deliverDue(NOW);
			expect(repository.markSkipped).toHaveBeenCalledWith(
				"push-1",
				PushSkipReason.NOT_ELIGIBLE,
				NOW
			);
		});

		it("skips a Trip alert for a Camper who left the Trip, but still sends to the Host", async () => {
			const left = setup({
				rows: [row({ tripScoped: true, mandatory: true })],
				memberStatus: BookingMemberStatus.LEFT,
			});
			await left.service.deliverDue(NOW);
			expect(left.repository.markSkipped).toHaveBeenCalledWith(
				"push-1",
				PushSkipReason.NOT_ELIGIBLE,
				NOW
			);

			const host = setup({
				rows: [row({ recipientId: HOST, tripScoped: true })],
				memberStatus: null,
			});
			await host.service.deliverDue(NOW);
			expect(host.repository.markSent).toHaveBeenCalled();
		});

		it("honours a switched-off ordinary category but never a mandatory alert (BR-196)", async () => {
			const ordinary = setup({ allows: false });
			await ordinary.service.deliverDue(NOW);
			expect(ordinary.repository.markSkipped).toHaveBeenCalledWith(
				"push-1",
				PushSkipReason.PREFERENCE_OFF,
				NOW
			);

			const sos = setup({
				allows: false,
				rows: [row({ category: PushCategory.SOS, mandatory: true })],
			});
			await sos.service.deliverDue(NOW);
			expect(sos.preferences.allows).not.toHaveBeenCalled();
			expect(sos.sender.send).toHaveBeenCalledWith(expect.objectContaining({ highPriority: true }));
			expect(sos.repository.markSent).toHaveBeenCalled();
		});

		it("skips a recipient without a registered device", async () => {
			const { service, repository } = setup({ devices: [] });
			await service.deliverDue(NOW);
			expect(repository.markSkipped).toHaveBeenCalledWith("push-1", PushSkipReason.NO_DEVICE, NOW);
		});

		it("disables unregistered tokens and still counts the device that received it", async () => {
			const { service, repository } = setup({
				devices: ["dead", "alive"],
				send: (token) =>
					token === "dead"
						? { ok: false, unregistered: true, error: "FCM 404 UNREGISTERED" }
						: { ok: true },
			});
			await service.deliverDue(NOW);
			expect(repository.disableDevice).toHaveBeenCalledWith("device-0");
			expect(repository.markSent).toHaveBeenCalled();
		});

		it("treats a push whose every token is unregistered as having no device", async () => {
			const { service, repository } = setup({
				send: () => ({ ok: false, unregistered: true, error: "gone" }),
			});
			await service.deliverDue(NOW);
			expect(repository.markSkipped).toHaveBeenCalledWith("push-1", PushSkipReason.NO_DEVICE, NOW);
		});

		it("retries a temporary failure with an increasing, bounded delay (BR-198)", async () => {
			const { service, repository } = setup({
				rows: [row({ attempts: 2 })],
				send: () => ({ ok: false, unregistered: false, retryable: true, error: "FCM 503" }),
			});
			await expect(service.deliverDue(NOW)).resolves.toMatchObject({ retried: 1 });
			expect(repository.markAttemptFailed).toHaveBeenCalledWith(
				"push-1",
				"FCM 503",
				new Date(NOW.getTime() + 2 * 60_000),
				NOW
			);
			expect([1, 2, 3, 4].map(pushRetryDelayMs)).toEqual([60_000, 120_000, 240_000, 480_000]);
		});

		it("fails for good after the last attempt or on a rejected message", async () => {
			const last = setup({
				rows: [row({ attempts: 5 })],
				send: () => ({ ok: false, unregistered: false, retryable: true, error: "FCM 503" }),
			});
			await expect(last.service.deliverDue(NOW)).resolves.toMatchObject({ failed: 1 });
			expect(last.repository.markAttemptFailed).toHaveBeenCalledWith(
				"push-1",
				"FCM 503",
				null,
				NOW
			);

			const rejected = setup({
				send: () => ({ ok: false, unregistered: false, retryable: false, error: "FCM 400" }),
			});
			await expect(rejected.service.deliverDue(NOW)).resolves.toMatchObject({ failed: 1 });
			expect(rejected.repository.markAttemptFailed).toHaveBeenCalledWith(
				"push-1",
				"FCM 400",
				null,
				NOW
			);
		});

		it("records an unexpected error as a failed attempt instead of losing the push", async () => {
			const { service, repository, sender } = setup();
			sender.send.mockRejectedValueOnce(new Error("boom"));
			await expect(service.deliverDue(NOW)).resolves.toMatchObject({ retried: 1 });
			expect(repository.markAttemptFailed).toHaveBeenCalledWith(
				"push-1",
				"Unexpected delivery error: boom",
				expect.any(Date),
				NOW
			);
		});
	});
});

describe("PushDeliveryWorker (CTMS-090)", () => {
	const config = (values: Record<string, string>) =>
		({ get: (key: string) => values[key] }) as unknown as ConfigService;

	it("does nothing unless enabled", async () => {
		const pushes = { deliverDue: jest.fn() };
		const worker = new PushDeliveryWorker(
			config({}),
			pushes as unknown as PushNotificationsService
		);
		worker.onApplicationBootstrap();
		await worker.onApplicationShutdown();
		expect(pushes.deliverDue).not.toHaveBeenCalled();
	});

	it("runs a pass on start and survives a failing pass", async () => {
		const pushes = { deliverDue: jest.fn().mockRejectedValue(new Error("db down")) };
		const worker = new PushDeliveryWorker(
			config({ PUSH_DELIVERY_WORKER_ENABLED: "true", PUSH_DELIVERY_BATCH_SIZE: "7" }),
			pushes as unknown as PushNotificationsService
		);
		worker.onApplicationBootstrap();
		await worker.onApplicationShutdown();
		expect(pushes.deliverDue).toHaveBeenCalledWith(expect.any(Date), 7);
	});
});
