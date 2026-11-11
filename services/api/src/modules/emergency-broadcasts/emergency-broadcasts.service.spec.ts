import { ConflictException, NotFoundException } from "@nestjs/common";
import type { EventsGateway } from "../realtime/events.gateway";
import type { CreateEmergencyBroadcastDto } from "./dto/create-emergency-broadcast.dto";
import type { EmergencyBroadcastsRepository } from "./emergency-broadcasts.repository";
import { EmergencyBroadcastsService } from "./emergency-broadcasts.service";
import {
	type BroadcastTrip,
	EmergencyAlertType,
	type EmergencyBroadcast,
	EmergencyBroadcastRecipientRole,
} from "./emergency-broadcasts.types";

const HOST = "host-1";
const TRIP = "trip-1";
const BROADCAST = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = new Date("2026-11-07T08:00:00.000Z");

const dto: CreateEmergencyBroadcastDto = {
	id: BROADCAST,
	alertType: EmergencyAlertType.SEVERE_WEATHER,
	content: "  Mưa lớn, dừng tại Trạm nghỉ suối.  ",
};

function stored(overrides: Partial<EmergencyBroadcast> = {}): EmergencyBroadcast {
	return {
		id: BROADCAST,
		tripId: TRIP,
		hostId: HOST,
		alertType: EmergencyAlertType.SEVERE_WEATHER,
		content: "Mưa lớn, dừng tại Trạm nghỉ suối.",
		recipientCount: 2,
		createdAt: CREATED_AT,
		...overrides,
	};
}

const recipients = [
	{ userId: "camper-1", role: EmergencyBroadcastRecipientRole.CAMPER },
	{ userId: "porter-1", role: EmergencyBroadcastRecipientRole.PORTER },
];

function build(
	options: {
		trip?: BroadcastTrip | null;
		existing?: EmergencyBroadcast | null;
		createResult?: Awaited<ReturnType<EmergencyBroadcastsRepository["create"]>>;
		participant?: boolean;
	} = {}
) {
	const trip =
		options.trip === undefined
			? { id: TRIP, hostId: HOST, status: "ongoing", title: "Trip Tà Năng" }
			: options.trip;
	const repository = {
		findTrip: jest.fn().mockResolvedValue(trip),
		findById: jest.fn().mockResolvedValue(options.existing ?? null),
		create: jest
			.fn()
			.mockResolvedValue(
				options.createResult ?? { created: true, broadcast: stored(), recipients }
			),
		listForTrip: jest.fn().mockResolvedValue([stored()]),
		listForRecipient: jest.fn().mockResolvedValue([stored()]),
		isTripParticipant: jest.fn().mockResolvedValue(options.participant ?? false),
	};
	const events = { emitEmergencyBroadcast: jest.fn() };
	const service = new EmergencyBroadcastsService(
		repository as unknown as EmergencyBroadcastsRepository,
		events as unknown as EventsGateway
	);
	return { service, repository, events };
}

describe("EmergencyBroadcastsService (CTMS-081 / Jira CTMS-361)", () => {
	describe("create", () => {
		it("persists a Trip-scoped broadcast with trimmed content, then delivers it to the frozen recipients", async () => {
			const { service, repository, events } = build();
			const outcome = await service.create(HOST, TRIP, dto);

			expect(repository.create).toHaveBeenCalledWith({
				id: BROADCAST,
				tripId: TRIP,
				hostId: HOST,
				alertType: EmergencyAlertType.SEVERE_WEATHER,
				content: "Mưa lớn, dừng tại Trạm nghỉ suối.",
			});
			expect(outcome).toEqual({
				created: true,
				broadcast: {
					id: BROADCAST,
					tripId: TRIP,
					hostId: HOST,
					alertType: EmergencyAlertType.SEVERE_WEATHER,
					content: "Mưa lớn, dừng tại Trạm nghỉ suối.",
					recipientCount: 2,
					createdAt: CREATED_AT.toISOString(),
				},
			});
			expect(events.emitEmergencyBroadcast).toHaveBeenCalledWith(["camper-1", "porter-1", HOST], {
				eventId: BROADCAST,
				broadcastId: BROADCAST,
				tripId: TRIP,
				tripTitle: "Trip Tà Năng",
				hostId: HOST,
				alertType: EmergencyAlertType.SEVERE_WEATHER,
				content: "Mưa lớn, dừng tại Trạm nghỉ suối.",
				createdAt: CREATED_AT.toISOString(),
			});
			const persistOrder = repository.create.mock.invocationCallOrder[0];
			expect(events.emitEmergencyBroadcast.mock.invocationCallOrder[0]).toBeGreaterThan(
				persistOrder
			);
		});

		it.each([
			["another Host's Trip", { id: TRIP, hostId: "other-host", status: "ongoing", title: "x" }],
			["an absent Trip", null],
		])("hides %s with 404 and stores nothing", async (_label, trip) => {
			const { service, repository, events } = build({ trip });
			await expect(service.create(HOST, TRIP, dto)).rejects.toBeInstanceOf(NotFoundException);
			expect(repository.create).not.toHaveBeenCalled();
			expect(events.emitEmergencyBroadcast).not.toHaveBeenCalled();
		});

		it.each(["draft", "pending_approval", "completed", "cancelled", "rejected"])(
			"rejects a %s Trip with 409",
			async (status) => {
				const { service, repository } = build({
					trip: { id: TRIP, hostId: HOST, status, title: "x" },
				});
				await expect(service.create(HOST, TRIP, dto)).rejects.toBeInstanceOf(ConflictException);
				expect(repository.create).not.toHaveBeenCalled();
			}
		);

		it("allows a published (upcoming) Trip", async () => {
			const { service } = build({
				trip: { id: TRIP, hostId: HOST, status: "published", title: "x" },
			});
			await expect(service.create(HOST, TRIP, dto)).resolves.toMatchObject({ created: true });
		});

		it("returns the stored broadcast for a retried request without persisting or delivering again", async () => {
			const { service, repository, events } = build({ existing: stored() });
			const outcome = await service.create(HOST, TRIP, dto);
			expect(outcome.created).toBe(false);
			expect(outcome.broadcast.id).toBe(BROADCAST);
			expect(repository.create).not.toHaveBeenCalled();
			expect(events.emitEmergencyBroadcast).not.toHaveBeenCalled();
		});

		it("treats a concurrent duplicate that lost the insert race as a retry", async () => {
			const { service, events } = build({
				createResult: { created: false, broadcast: stored() },
			});
			await expect(service.create(HOST, TRIP, dto)).resolves.toMatchObject({ created: false });
			expect(events.emitEmergencyBroadcast).not.toHaveBeenCalled();
		});

		it.each([
			["a different Trip", { tripId: "trip-2" }],
			["a different alert type", { alertType: EmergencyAlertType.EVACUATION }],
			["different content", { content: "Nội dung khác" }],
		])("rejects reuse of the broadcast ID for %s with 409", async (_label, overrides) => {
			const { service, events } = build({ existing: stored(overrides) });
			await expect(service.create(HOST, TRIP, dto)).rejects.toBeInstanceOf(ConflictException);
			expect(events.emitEmergencyBroadcast).not.toHaveBeenCalled();
		});

		it("still notifies the Host's own sessions when the Trip has no eligible recipient", async () => {
			const { service, events } = build({
				createResult: { created: true, broadcast: stored({ recipientCount: 0 }), recipients: [] },
			});
			await service.create(HOST, TRIP, dto);
			expect(events.emitEmergencyBroadcast).toHaveBeenCalledWith([HOST], expect.anything());
		});
	});

	describe("list", () => {
		it("gives the managing Host every broadcast with its recipient count", async () => {
			const { service, repository } = build();
			const [view] = await service.list(HOST, TRIP);
			expect(repository.listForTrip).toHaveBeenCalledWith(TRIP);
			expect(view.recipientCount).toBe(2);
		});

		it("gives a Trip participant only broadcasts addressed to them, without the audience size", async () => {
			const { service, repository } = build({ participant: true });
			const [view] = await service.list("camper-1", TRIP);
			expect(repository.listForRecipient).toHaveBeenCalledWith(TRIP, "camper-1");
			expect(view.recipientCount).toBeNull();
		});

		it("hides the Trip from an unrelated user", async () => {
			const { service, repository } = build({ participant: false });
			await expect(service.list("stranger", TRIP)).rejects.toBeInstanceOf(NotFoundException);
			expect(repository.listForRecipient).not.toHaveBeenCalled();
		});

		it("returns 404 for an absent Trip", async () => {
			const { service } = build({ trip: null });
			await expect(service.list(HOST, TRIP)).rejects.toBeInstanceOf(NotFoundException);
		});
	});
});
