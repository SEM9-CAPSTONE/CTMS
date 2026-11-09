import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import type { TripsRepository } from "../repositories/trips.repository";
import type { TripsService } from "../services/trips.service";
import type { HostWeatherPenaltiesService } from "./host-weather-penalties.service";
import type { TripWeatherDecisionAlertsService } from "./trip-weather-decision-alerts.service";
import { TripWeatherDecisionAlertsService as AlertsService } from "./trip-weather-decision-alerts.service";
import {
	dueWeatherAlerts,
	interventionUrgency,
	isLateHostDecision,
	isWithinDecisionWindow,
	needsAdminIntervention,
	weatherAlertMessage,
} from "./trip-weather-decision.policy";
import { TripWeatherDecisionService } from "./trip-weather-decision.service";
import { TripWeatherDecisionWorker } from "./trip-weather-decision.worker";
import type {
	RedTripCandidate,
	TripWeatherDecisionsRepository,
	WeatherDecisionTrip,
} from "./trip-weather-decisions.repository";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-15T00:00:00.000Z");
const at = (hoursBeforeStart: number) => new Date(NOW.getTime() + hoursBeforeStart * HOUR);

describe("weather decision policy (§5)", () => {
	const state = (hours: number, extra: Partial<Parameters<typeof dueWeatherAlerts>[0]> = {}) => ({
		startsAt: at(hours),
		hostDecision: null,
		adminDecided: false,
		...extra,
	});

	it("opens the decision window only in the last 3 days before departure", () => {
		expect(isWithinDecisionWindow(at(73), NOW)).toBe(false);
		expect(isWithinDecisionWindow(at(72), NOW)).toBe(true);
		expect(isWithinDecisionWindow(at(0), NOW)).toBe(false);
	});

	it("flags a Host decision after T-24h as late", () => {
		expect(isLateHostDecision(at(25), NOW)).toBe(false);
		expect(isLateHostDecision(at(24), NOW)).toBe(true);
	});

	it("reminds the Host at T-48h and escalates to the Admin at T-24h, T-12h and T-6h", () => {
		expect(dueWeatherAlerts(state(49), NOW)).toEqual([]);
		expect(dueWeatherAlerts(state(48), NOW)).toEqual(["host_t48"]);
		expect(dueWeatherAlerts(state(24), NOW)).toEqual(["host_t48", "admin_t24"]);
		expect(dueWeatherAlerts(state(12), NOW)).toEqual(["host_t48", "admin_t12"]);
		expect(dueWeatherAlerts(state(6), NOW)).toEqual(["host_t48", "admin_t6"]);
		expect(dueWeatherAlerts(state(0), NOW)).toEqual([]);
	});

	it("tells the Admin at once when the Host keeps, and stops after cancel, reschedule or an Admin action", () => {
		expect(dueWeatherAlerts(state(40, { hostDecision: "keep" }), NOW)).toEqual(["admin_kept"]);
		expect(dueWeatherAlerts(state(10, { hostDecision: "cancel" }), NOW)).toEqual([]);
		expect(dueWeatherAlerts(state(10, { hostDecision: "reschedule" }), NOW)).toEqual([]);
		expect(dueWeatherAlerts(state(10, { adminDecided: true }), NOW)).toEqual([]);
	});

	it("needs the Admin only after T-24h without an answer, or after a Host keep", () => {
		expect(needsAdminIntervention(state(30), NOW)).toBe(false);
		expect(needsAdminIntervention(state(20), NOW)).toBe(true);
		expect(needsAdminIntervention(state(60, { hostDecision: "keep" }), NOW)).toBe(true);
	});

	it("raises urgency as departure approaches and words each reminder", () => {
		expect(interventionUrgency(at(20), NOW)).toBe("normal");
		expect(interventionUrgency(at(12), NOW)).toBe("urgent");
		expect(interventionUrgency(at(6), NOW)).toBe("critical");
		expect(weatherAlertMessage("host_t48", "Tà Năng")).toContain("Giữ / Dời / Huỷ");
		expect(weatherAlertMessage("admin_t6", "Tà Năng")).toMatch(/^Khẩn cấp/);
	});
});

function trip(overrides: Partial<WeatherDecisionTrip> = {}): WeatherDecisionTrip {
	return {
		id: "trip-1",
		hostId: "host-1",
		title: "Tà Năng",
		status: "published",
		startsAt: at(30),
		weatherPausedAt: null,
		weatherPauseReason: null,
		...overrides,
	};
}

function setup(options: { trip?: WeatherDecisionTrip | null; risk?: "green" | "red" | null } = {}) {
	const manager = { getRepository: () => ({ save: jest.fn() }) } as unknown as EntityManager;
	const decisions = {
		findTrip: jest.fn().mockResolvedValue(options.trip === undefined ? trip() : options.trip),
		findLatestForecast: jest
			.fn()
			.mockResolvedValue(
				options.risk === null
					? null
					: { id: "f-1", status: "available", riskLevel: options.risk ?? "red" }
			),
		findDecisionsForSchedule: jest.fn().mockResolvedValue([]),
		findDecisions: jest.fn().mockResolvedValue([]),
		insertDecision: jest.fn().mockImplementation(async (_manager, input) => ({
			id: "d-1",
			deciderName: null,
			...input,
		})),
		setPause: jest.fn(),
		findRedTripsStartingWithin: jest.fn().mockResolvedValue([]),
	};
	const tripsService = {
		cancel: jest.fn(async (_actor, _trip, _dto, opts) => opts.withinTransaction(manager, {})),
		reschedule: jest.fn(async (_actor, _trip, _dto, _at, opts) =>
			opts.withinTransaction(manager, {})
		),
	};
	const alerts = { send: jest.fn().mockResolvedValue([]) };
	const penalties = {
		paidBookingValue: jest.fn().mockResolvedValue("12000000.00"),
		createInTransaction: jest.fn().mockResolvedValue({ id: "p-1", hostId: "host-1" }),
		notifyCreated: jest.fn(),
	};
	const dataSource = {
		transaction: jest.fn(async (work: (m: EntityManager) => unknown) => work(manager)),
	};
	const service = new TripWeatherDecisionService(
		dataSource as unknown as DataSource,
		decisions as unknown as TripWeatherDecisionsRepository,
		tripsService as unknown as TripsService,
		{} as TripsRepository,
		alerts as unknown as TripWeatherDecisionAlertsService,
		penalties as unknown as HostWeatherPenaltiesService
	);
	return { service, decisions, tripsService, alerts, penalties };
}

describe("TripWeatherDecisionService", () => {
	const keep = {
		decision: "keep" as const,
		reason: "Có Porter dày kinh nghiệm",
		safetyPlan: "Rút sớm",
	};

	it("records a Host keep with its safety plan and alerts the Admins at once", async () => {
		const { service, decisions, alerts } = setup();
		const saved = await service.decideAsHost("host-1", "trip-1", keep, NOW);
		expect(saved).toMatchObject({
			decision: "keep",
			deciderRole: "host",
			late: false,
			riskLevel: "red",
		});
		expect(decisions.insertDecision.mock.calls[0][1]).toMatchObject({
			safetyPlan: "Rút sớm",
			forecastId: "f-1",
		});
		expect(alerts.send).toHaveBeenCalledWith(expect.objectContaining({ tripId: "trip-1" }), [
			"admin_kept",
		]);
	});

	it("requires a safety plan to keep and refuses other Hosts", async () => {
		const { service } = setup();
		await expect(
			service.decideAsHost("host-1", "trip-1", { decision: "keep", reason: "x" }, NOW)
		).rejects.toBeInstanceOf(UnprocessableEntityException);
		await expect(service.decideAsHost("host-2", "trip-1", keep, NOW)).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it("refuses outside 3 days, before Red, on a non-published Trip or after an Admin decided", async () => {
		await expect(
			setup({ trip: trip({ startsAt: at(80) }) }).service.decideAsHost(
				"host-1",
				"trip-1",
				keep,
				NOW
			)
		).rejects.toBeInstanceOf(ConflictException);
		await expect(
			setup({ risk: "green" }).service.decideAsHost("host-1", "trip-1", keep, NOW)
		).rejects.toBeInstanceOf(ConflictException);
		await expect(
			setup({ trip: trip({ status: "cancelled" }) }).service.decideAsHost(
				"host-1",
				"trip-1",
				keep,
				NOW
			)
		).rejects.toBeInstanceOf(ConflictException);
		const { service, decisions } = setup();
		decisions.findDecisionsForSchedule.mockResolvedValue([{ deciderRole: "admin" }]);
		await expect(service.decideAsHost("host-1", "trip-1", keep, NOW)).rejects.toBeInstanceOf(
			ConflictException
		);
		await expect(
			setup({ trip: null }).service.decideAsHost("host-1", "trip-1", keep, NOW)
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("cancels through the Host cancel flow (100% refund) and marks a decision after T-24h as late", async () => {
		const { service, tripsService, alerts } = setup({ trip: trip({ startsAt: at(10) }) });
		const saved = await service.decideAsHost(
			"host-1",
			"trip-1",
			{ decision: "cancel", reason: "Bão" },
			NOW
		);
		expect(tripsService.cancel).toHaveBeenCalledWith(
			"host-1",
			"trip-1",
			{ reason: "Huỷ vì thời tiết: Bão" },
			expect.objectContaining({ actingAsAdmin: false })
		);
		expect(saved).toMatchObject({ decision: "cancel", late: true });
		expect(alerts.send).not.toHaveBeenCalled();
	});

	it("reschedules with the weather audit reason and needs a new start", async () => {
		const { service, tripsService } = setup();
		await expect(
			service.decideAsHost("host-1", "trip-1", { decision: "reschedule", reason: "Bão" }, NOW)
		).rejects.toBeInstanceOf(UnprocessableEntityException);
		await service.decideAsHost(
			"host-1",
			"trip-1",
			{ decision: "reschedule", reason: "Bão", startsAt: "2026-11-25T00:00:00.000Z" },
			NOW
		);
		expect(tripsService.reschedule.mock.calls[0][4]).toMatchObject({
			auditReason: "weather_reschedule",
		});
	});

	it("lets an Admin pause and resume (resume even when no longer Red), lifting the pause on other decisions", async () => {
		const paused = setup({ trip: trip({ weatherPausedAt: NOW }), risk: "green" });
		await paused.service.decideAsAdmin(
			"admin-1",
			"trip-1",
			{ decision: "resume", reason: "Trời quang" },
			NOW
		);
		expect(paused.decisions.setPause).toHaveBeenCalledWith(expect.anything(), "trip-1", null, null);

		const running = setup();
		await running.service.decideAsAdmin(
			"admin-1",
			"trip-1",
			{ decision: "pause", reason: "Lũ" },
			NOW
		);
		expect(running.decisions.setPause).toHaveBeenCalledWith(expect.anything(), "trip-1", NOW, "Lũ");
		await expect(
			running.service.decideAsAdmin("admin-1", "trip-1", { decision: "resume", reason: "x" }, NOW)
		).rejects.toBeInstanceOf(ConflictException);

		const cancel = setup({ trip: trip({ weatherPausedAt: NOW }) });
		await cancel.service.decideAsAdmin(
			"admin-1",
			"trip-1",
			{ decision: "cancel", reason: "Lũ" },
			NOW
		);
		expect(cancel.tripsService.cancel.mock.calls[0][3]).toMatchObject({ actingAsAdmin: true });
		expect(cancel.decisions.setPause).toHaveBeenCalledWith(expect.anything(), "trip-1", null, null);
	});

	it("penalises the Host on the first Admin decision after T-24h without an on-time Host answer (policy §6)", async () => {
		const late = setup({ trip: trip({ startsAt: at(10) }) });
		late.decisions.findDecisionsForSchedule.mockResolvedValue([
			{ deciderRole: "host", decision: "keep", late: true },
		]);
		await late.service.decideAsAdmin(
			"admin-1",
			"trip-1",
			{ decision: "cancel", reason: "Lũ" },
			NOW
		);
		expect(late.penalties.paidBookingValue).toHaveBeenCalledWith("trip-1");
		expect(late.penalties.createInTransaction).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				decisionId: "d-1",
				adminId: "admin-1",
				bookingValue: "12000000.00",
			})
		);
		expect(late.penalties.notifyCreated).toHaveBeenCalledWith({ id: "p-1", hostId: "host-1" });
	});

	it("does not penalise before T-24h, after an on-time Host Keep, or on a second Admin decision", async () => {
		const early = setup({ trip: trip({ startsAt: at(30) }) });
		await early.service.decideAsAdmin(
			"admin-1",
			"trip-1",
			{ decision: "pause", reason: "Lũ" },
			NOW
		);
		expect(early.penalties.createInTransaction).not.toHaveBeenCalled();

		const kept = setup({ trip: trip({ startsAt: at(10) }) });
		kept.decisions.findDecisionsForSchedule.mockResolvedValue([
			{ deciderRole: "host", decision: "keep", late: false },
		]);
		await kept.service.decideAsAdmin("admin-1", "trip-1", { decision: "pause", reason: "Lũ" }, NOW);
		expect(kept.penalties.createInTransaction).not.toHaveBeenCalled();

		const again = setup({ trip: trip({ startsAt: at(10), weatherPausedAt: NOW }) });
		again.decisions.findDecisionsForSchedule.mockResolvedValue([
			{ deciderRole: "admin", decision: "pause", late: false },
		]);
		await again.service.decideAsAdmin(
			"admin-1",
			"trip-1",
			{ decision: "resume", reason: "Ổn" },
			NOW
		);
		expect(again.penalties.paidBookingValue).not.toHaveBeenCalled();
	});

	it("refuses an Admin pause on a Trip already paused or more than 3 days away", async () => {
		await expect(
			setup({ trip: trip({ weatherPausedAt: NOW }) }).service.decideAsAdmin(
				"admin-1",
				"trip-1",
				{ decision: "pause", reason: "x" },
				NOW
			)
		).rejects.toBeInstanceOf(ConflictException);
		await expect(
			setup({ trip: trip({ startsAt: at(100) }) }).service.decideAsAdmin(
				"admin-1",
				"trip-1",
				{ decision: "pause", reason: "x" },
				NOW
			)
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("shows the decision log only to the owning Host and Admins", async () => {
		const { service } = setup();
		await expect(
			service.getDecisionLog(
				{ userId: "host-2", roles: ["host"], status: "active" } as never,
				"trip-1"
			)
		).rejects.toBeInstanceOf(NotFoundException);
		const log = await service.getDecisionLog(
			{ userId: "admin-1", roles: ["admin"], status: "active" } as never,
			"trip-1"
		);
		expect(log).toMatchObject({ tripId: "trip-1", latestRiskLevel: "red", decisions: [] });
	});

	it("lists interventions most urgent first, with why the Admin is needed", async () => {
		const { service, decisions } = setup();
		const candidate = (id: string, hours: number, hostDecision: RedTripCandidate["hostDecision"]) =>
			({
				tripId: id,
				hostId: "host-1",
				title: id,
				startsAt: at(hours),
				forecastId: "f",
				weatherPausedAt: null,
				hostDecision,
				hostDecisionReason: null,
				hostSafetyPlan: null,
				hostDecidedAt: null,
				adminDecided: false,
			}) as RedTripCandidate;
		decisions.findRedTripsStartingWithin.mockResolvedValue([
			candidate("kept", 50, "keep"),
			candidate("waiting", 40, null),
			candidate("late", 5, null),
		]);
		const list = await service.listInterventions(NOW);
		expect(list.map((item) => [item.tripId, item.reason, item.urgency])).toEqual([
			["late", "no_response", "critical"],
			["kept", "host_kept", "normal"],
		]);
	});
});

describe("TripWeatherDecisionAlertsService", () => {
	function alertsSetup(candidates: Partial<RedTripCandidate>[]) {
		const repository = {
			findActiveAdminIds: jest.fn().mockResolvedValue(["admin-1", "admin-2"]),
			insertAlerts: jest.fn(async (rows) =>
				rows.map((row: Record<string, unknown>, index: number) => ({
					id: `a-${index}`,
					readAt: null,
					createdAt: NOW,
					...row,
				}))
			),
			findRedTripsStartingWithin: jest.fn().mockResolvedValue(candidates),
		};
		const events = { emitTripWeatherDecisionRequired: jest.fn() };
		const service = new AlertsService(repository as never, events as never);
		return { service, repository, events };
	}

	it("sends the Host reminder to the Host and escalations to every active Admin, over the socket", async () => {
		const { service, repository, events } = alertsSetup([
			{
				tripId: "t",
				hostId: "host-1",
				title: "T",
				startsAt: at(20),
				forecastId: "f",
				hostDecision: null,
				adminDecided: false,
			},
		]);
		const result = await service.sendDueAlerts(NOW, 50);
		const rows = repository.insertAlerts.mock.calls[0][0];
		expect(
			rows.map(
				(row: { recipientId: string; milestone: string }) => `${row.milestone}:${row.recipientId}`
			)
		).toEqual(["host_t48:host-1", "admin_t24:admin-1", "admin_t24:admin-2"]);
		expect(result).toEqual({ checked: 1, sent: 3 });
		expect(events.emitTripWeatherDecisionRequired).toHaveBeenCalledTimes(3);
	});

	it("keeps going when one Trip fails", async () => {
		const { service, repository } = alertsSetup([
			{
				tripId: "a",
				hostId: "h",
				title: "A",
				startsAt: at(40),
				forecastId: "f",
				hostDecision: null,
				adminDecided: false,
			},
			{
				tripId: "b",
				hostId: "h",
				title: "B",
				startsAt: at(40),
				forecastId: "f",
				hostDecision: null,
				adminDecided: false,
			},
		]);
		repository.insertAlerts.mockRejectedValueOnce(new Error("db down"));
		const result = await service.sendDueAlerts(NOW, 50);
		expect(result).toEqual({ checked: 2, sent: 1 });
	});
});

describe("TripWeatherDecisionWorker", () => {
	it("stays idle unless enabled and runs one pass per tick", async () => {
		const alerts = { sendDueAlerts: jest.fn().mockResolvedValue({ checked: 0, sent: 0 }) };
		const config = (enabled: string) => ({
			get: (key: string) => (key.endsWith("ENABLED") ? enabled : undefined),
		});
		const idle = new TripWeatherDecisionWorker(config("false") as never, alerts as never);
		idle.onApplicationBootstrap();
		expect(alerts.sendDueAlerts).not.toHaveBeenCalled();
		const worker = new TripWeatherDecisionWorker(config("false") as never, alerts as never);
		await worker.startTick(() => NOW);
		expect(alerts.sendDueAlerts).toHaveBeenCalledWith(NOW, 100);
	});

	it("survives a failed pass", async () => {
		const alerts = { sendDueAlerts: jest.fn().mockRejectedValue(new Error("boom")) };
		const worker = new TripWeatherDecisionWorker(
			{ get: () => undefined } as never,
			alerts as never
		);
		await expect(worker.startTick(() => NOW)).resolves.toBeUndefined();
	});
});
