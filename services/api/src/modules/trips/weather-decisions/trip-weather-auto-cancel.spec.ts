import type { DataSource, EntityManager } from "typeorm";
import type { TripsRepository } from "../repositories/trips.repository";
import type { TripsService } from "../services/trips.service";
import type { HostWeatherPenaltiesService } from "./host-weather-penalties.service";
import { TripWeatherDecisionAlertsService } from "./trip-weather-decision-alerts.service";
import {
	WEATHER_AUTO_CANCEL_MS,
	isAutoCancelDue,
	weatherAlertMessage,
	weatherAutoCancelAt,
} from "./trip-weather-decision.policy";
import {
	AUTO_CANCEL_WEATHER_REASON,
	TripWeatherDecisionService,
} from "./trip-weather-decision.service";
import { TripWeatherDecisionWorker } from "./trip-weather-decision.worker";
import type {
	TripWeatherDecisionsRepository,
	WeatherDecisionTrip,
} from "./trip-weather-decisions.repository";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-15T00:00:00.000Z");
const at = (hoursBeforeStart: number) => new Date(NOW.getTime() + hoursBeforeStart * HOUR);

describe("weather auto-cancel policy (T-6h)", () => {
	const state = (overrides: Partial<Parameters<typeof isAutoCancelDue>[0]> = {}) => ({
		startsAt: at(5),
		riskLevel: "red",
		decisions: [],
		...overrides,
	});

	it("cancels a Red Trip with no decision inside the last 6 hours", () => {
		expect(WEATHER_AUTO_CANCEL_MS).toBe(6 * HOUR);
		expect(isAutoCancelDue(state(), NOW)).toBe(true);
		expect(isAutoCancelDue(state({ startsAt: at(6) }), NOW)).toBe(true);
		expect(weatherAutoCancelAt(at(10))).toEqual(at(4));
	});

	it("waits before T-6h and never touches a started Trip", () => {
		expect(isAutoCancelDue(state({ startsAt: at(6.01) }), NOW)).toBe(false);
		expect(isAutoCancelDue(state({ startsAt: at(0) }), NOW)).toBe(false);
	});

	it("only follows the rule-based Red level", () => {
		expect(isAutoCancelDue(state({ riskLevel: "yellow" }), NOW)).toBe(false);
		expect(isAutoCancelDue(state({ riskLevel: null }), NOW)).toBe(false);
	});

	it.each(["keep", "reschedule", "cancel", "resume"] as const)(
		"respects a %s decision for the schedule",
		(decision) => {
			expect(isAutoCancelDue(state({ decisions: [decision] }), NOW)).toBe(false);
		}
	);

	it("still cancels a Trip that an Admin only paused", () => {
		expect(isAutoCancelDue(state({ decisions: ["pause"] }), NOW)).toBe(true);
	});

	it("tells the Host and Admins that Campers get a full refund", () => {
		expect(weatherAlertMessage("auto_cancelled", "Bà Nà")).toContain("hoàn 100%");
	});
});

function trip(overrides: Partial<WeatherDecisionTrip> = {}): WeatherDecisionTrip {
	return {
		id: "trip-1",
		hostId: "host-1",
		title: "Bà Nà mưa lớn",
		status: "published",
		startsAt: at(5),
		weatherPausedAt: null,
		weatherPauseReason: null,
		...overrides,
	};
}

function setup(
	options: {
		trip?: WeatherDecisionTrip;
		risk?: "red" | "yellow";
		schedule?: Array<{ decision: string; deciderRole: string; late?: boolean }>;
		/** Decisions seen again inside the locked transaction (defaults to `schedule`). */
		lockedSchedule?: Array<{ decision: string; deciderRole: string }>;
	} = {}
) {
	const manager = { getRepository: () => ({ save: jest.fn() }) } as unknown as EntityManager;
	const schedule = options.schedule ?? [];
	const decisions = {
		findTrip: jest.fn().mockResolvedValue(options.trip ?? trip()),
		findLatestForecast: jest
			.fn()
			.mockResolvedValue({ id: "f-1", status: "available", riskLevel: options.risk ?? "red" }),
		findDecisionsForSchedule: jest
			.fn()
			.mockImplementation(async (_tripId, _startsAt, lockedManager) =>
				lockedManager ? (options.lockedSchedule ?? schedule) : schedule
			),
		insertDecision: jest.fn().mockImplementation(async (_manager, input) => ({
			id: "d-1",
			deciderName: null,
			...input,
		})),
		setPause: jest.fn(),
		findAutoCancelCandidateIds: jest.fn().mockResolvedValue(["trip-1", "trip-2"]),
	};
	const tripsService = {
		cancel: jest.fn(async (_actor, _trip, _dto, opts) => opts.withinTransaction(manager, {})),
	};
	const alerts = { send: jest.fn().mockResolvedValue([]) };
	const penalties = {
		paidBookingValue: jest.fn().mockResolvedValue("12000000.00"),
		createInTransaction: jest.fn().mockResolvedValue({ id: "p-1", hostId: "host-1" }),
		notifyCreated: jest.fn(),
	};
	const service = new TripWeatherDecisionService(
		{} as DataSource,
		decisions as unknown as TripWeatherDecisionsRepository,
		tripsService as unknown as TripsService,
		{} as TripsRepository,
		alerts as unknown as TripWeatherDecisionAlertsService,
		penalties as unknown as HostWeatherPenaltiesService
	);
	return { service, decisions, tripsService, alerts, penalties };
}

describe("TripWeatherDecisionService.autoCancel", () => {
	it("cancels as the system, refunds through the Host cancel path, penalises and notifies", async () => {
		const { service, decisions, tripsService, alerts, penalties } = setup();
		await expect(service.autoCancel("trip-1", NOW)).resolves.toBe("cancelled");

		const [actor, tripId, dto, opts] = tripsService.cancel.mock.calls[0];
		expect([actor, tripId]).toEqual(["host-1", "trip-1"]);
		expect(dto.reason).toBe(`Huỷ vì thời tiết: ${AUTO_CANCEL_WEATHER_REASON}`);
		expect(opts).toMatchObject({ actingAsAdmin: true, auditActorId: null });
		expect(decisions.setPause).toHaveBeenCalledWith(expect.anything(), "trip-1", null, null);
		expect(decisions.insertDecision.mock.calls[0][1]).toMatchObject({
			decidedBy: null,
			deciderRole: "system",
			decision: "cancel",
			reason: AUTO_CANCEL_WEATHER_REASON,
			riskLevel: "red",
		});
		expect(penalties.createInTransaction).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ adminId: null, decisionId: "d-1", bookingValue: "12000000.00" })
		);
		expect(penalties.notifyCreated).toHaveBeenCalled();
		expect(alerts.send).toHaveBeenCalledWith(expect.objectContaining({ hostId: "host-1" }), [
			"auto_cancelled",
		]);
	});

	it("does not penalise twice when an Admin pause already penalised the schedule", async () => {
		const paused = setup({ schedule: [{ decision: "pause", deciderRole: "admin" }] });
		await expect(paused.service.autoCancel("trip-1", NOW)).resolves.toBe("cancelled");
		expect(paused.penalties.createInTransaction).not.toHaveBeenCalled();
	});

	it.each([
		["the Trip is no longer published", { trip: trip({ status: "cancelled" }) }],
		["the forecast is no longer Red", { risk: "yellow" as const }],
		["it is still before T-6h", { trip: trip({ startsAt: at(8) }) }],
		["the Host kept it", { schedule: [{ decision: "keep", deciderRole: "host" }] }],
	])("skips when %s", async (_label, options) => {
		const { service, tripsService, alerts } = setup(options);
		await expect(service.autoCancel("trip-1", NOW)).resolves.toBe("skipped");
		expect(tripsService.cancel).not.toHaveBeenCalled();
		expect(alerts.send).not.toHaveBeenCalled();
	});

	it("lets a decision taken meanwhile win and rolls the cancel back", async () => {
		const { service, decisions, alerts } = setup({
			lockedSchedule: [{ decision: "keep", deciderRole: "admin" }],
		});
		await expect(service.autoCancel("trip-1", NOW)).resolves.toBe("skipped");
		expect(decisions.insertDecision).not.toHaveBeenCalled();
		expect(alerts.send).not.toHaveBeenCalled();
	});

	it("goes through every candidate and counts failures without stopping", async () => {
		const { service, decisions, tripsService } = setup();
		tripsService.cancel.mockRejectedValueOnce(new Error("locked"));
		await expect(service.autoCancelDueTrips(NOW, 50)).resolves.toEqual({
			checked: 2,
			cancelled: 1,
			failed: 1,
		});
		expect(decisions.findAutoCancelCandidateIds).toHaveBeenCalledWith(NOW, 6 * HOUR, 50);
	});
});

describe("auto-cancel notice and worker", () => {
	it("sends the auto-cancel notice to the Host and every Admin", async () => {
		const repository = {
			findActiveAdminIds: jest.fn().mockResolvedValue(["admin-1", "admin-2"]),
			insertAlerts: jest.fn().mockResolvedValue([]),
		};
		const alerts = new TripWeatherDecisionAlertsService(repository as never);
		await alerts.send(
			{ tripId: "trip-1", hostId: "host-1", title: "Bà Nà", startsAt: at(5), forecastId: null },
			["auto_cancelled"]
		);
		const rows = repository.insertAlerts.mock.calls[0][0] as Array<{ recipientId: string }>;
		expect(rows.map((row) => row.recipientId)).toEqual(["host-1", "admin-1", "admin-2"]);
	});

	const config = (autoCancel: string | undefined) => ({
		get: (key: string) => (key === "TRIP_WEATHER_AUTO_CANCEL_ENABLED" ? autoCancel : undefined),
	});

	it("cancels before sending reminders on each pass", async () => {
		const order: string[] = [];
		const alerts = {
			sendDueAlerts: jest.fn(async () => {
				order.push("alerts");
				return { checked: 0, sent: 0 };
			}),
		};
		const decisionService = {
			autoCancelDueTrips: jest.fn(async () => {
				order.push("auto-cancel");
				return { checked: 1, cancelled: 1, failed: 0 };
			}),
		};
		const worker = new TripWeatherDecisionWorker(
			config(undefined) as never,
			alerts as never,
			decisionService as never
		);
		await worker.startTick(() => NOW);
		expect(decisionService.autoCancelDueTrips).toHaveBeenCalledWith(NOW, 100);
		expect(order).toEqual(["auto-cancel", "alerts"]);
	});

	it("can be switched off with TRIP_WEATHER_AUTO_CANCEL_ENABLED=false", async () => {
		const alerts = { sendDueAlerts: jest.fn().mockResolvedValue({ checked: 0, sent: 0 }) };
		const decisionService = { autoCancelDueTrips: jest.fn() };
		const worker = new TripWeatherDecisionWorker(
			config("false") as never,
			alerts as never,
			decisionService as never
		);
		await worker.startTick(() => NOW);
		expect(decisionService.autoCancelDueTrips).not.toHaveBeenCalled();
		expect(alerts.sendDueAlerts).toHaveBeenCalled();
	});
});
