import { NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import {
	toTripWeatherChangeNoticeDto,
	weatherChangeMessage,
} from "../dto/trip-weather-change-notice.dto";
import {
	type TripWeatherForecast,
	TripWeatherForecastStatus,
} from "../entities/trip-weather-forecast.entity";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";
import type { WeatherRiskRule } from "../entities/weather-risk-rule.entity";
import type { WeatherForecastHour } from "../providers/weather-provider.interface";
import type { TripWeatherChangeNoticeRow } from "../repositories/trip-weather-change-notices.repository";
import { TripWeatherChangeNotifier } from "./trip-weather-change-notifier.service";
import { TripWeatherForecastService } from "./trip-weather-forecast.service";
import {
	TRIP_WEATHER_HISTORY_RETENTION_MS,
	TRIP_WEATHER_MONITOR_FAR_INTERVAL_MS,
	TRIP_WEATHER_MONITOR_NEAR_INTERVAL_MS,
	TRIP_WEATHER_MONITOR_NEAR_WINDOW_MS,
	TripWeatherMonitorService,
} from "./trip-weather-monitor.service";
import { TripWeatherMonitorWorker } from "./trip-weather-monitor.worker";

/** CTMS-93 monitoring: history on change, raw-data policy, level-change notices, job and access. */
const NOW = new Date("2026-11-08T03:00:00.000Z");
const STARTS = new Date("2026-11-12T00:00:00.000Z");
const ENDS = new Date("2026-11-12T10:00:00.000Z");

const RULE = {
	id: "rule-1",
	rainfallYellowThreshold: 10,
	rainfallRedThreshold: 50,
	windYellowThreshold: 40,
	windRedThreshold: 70,
	tempLowYellow: 5,
	tempLowRed: 0,
	tempHighYellow: 38,
	tempHighRed: 42,
	visibilityYellowThreshold: 5000,
	visibilityRedThreshold: 1000,
	thunderstormYellow: true,
	thunderstormRed: true,
	rainfallWeight: 0.3,
	windWeight: 0.25,
	temperatureWeight: 0.15,
	visibilityWeight: 0.15,
	thunderstormWeight: 0.15,
	greenMaxScore: 0.5,
	yellowMaxScore: 1.2,
} as WeatherRiskRule;

const calmHour = (
	iso: string,
	overrides: Partial<WeatherForecastHour> = {}
): WeatherForecastHour => ({
	time: new Date(iso),
	rainfallMm: 0,
	windKph: 5,
	temperatureC: 22,
	visibilityM: 20000,
	thunderstorm: false,
	providerWeatherCode: 1,
	...overrides,
});
const stormHour = calmHour("2026-11-12T05:00:00Z", {
	rainfallMm: 80,
	windKph: 90,
	thunderstorm: true,
});

const calmWorst = {
	rainfallMm: 0,
	rainfallAt: "2026-11-12T00:00:00.000Z",
	windKph: 5,
	windAt: "2026-11-12T00:00:00.000Z",
	temperatureC: 22,
	temperatureAt: "2026-11-12T00:00:00.000Z",
	visibilityM: 20000,
	visibilityAt: "2026-11-12T00:00:00.000Z",
	thunderstorm: false,
	thunderstormAt: null,
	hoursCovered: 1,
};

function storedForecast(overrides: Partial<TripWeatherForecast> = {}): TripWeatherForecast {
	return {
		id: "stored-1",
		tripId: "trip-1",
		routeId: "route-1",
		status: TripWeatherForecastStatus.AVAILABLE,
		tripStartsAt: STARTS,
		tripEndsAt: ENDS,
		forecastFrom: STARTS,
		forecastTo: STARTS,
		worstReading: calmWorst,
		ruleVersionId: "rule-1",
		riskLevel: RiskLevel.GREEN,
		compositeScore: 0,
		criteriaScores: null,
		providerResponse: null,
		adviceText: null,
		adviceActions: null,
		adviceGeneratedAt: null,
		createdBy: "host-1",
		checkedAt: new Date("2026-11-07T03:00:00.000Z"),
		createdAt: new Date("2026-11-07T03:00:00.000Z"),
		...overrides,
	} as TripWeatherForecast;
}

function build(
	options: {
		trip?: Record<string, unknown>;
		latest?: TripWeatherForecast | null;
		previousAvailable?: TripWeatherForecast | null;
		hours?: WeatherForecastHour[];
	} = {}
) {
	const trip = {
		id: "trip-1",
		hostId: "host-1",
		status: "published",
		routeId: "route-1",
		startsAt: STARTS,
		endsAt: ENDS,
		submittedWeatherForecastId: null,
		centroid: [108.2, 16.05] as [number, number],
		...options.trip,
	};
	const forecastsRepository = {
		findTripForForecast: jest.fn().mockResolvedValue(trip),
		findLatestForTrip: jest.fn().mockResolvedValue(options.latest ?? null),
		findLatestAvailableForTrip: jest.fn().mockResolvedValue(options.previousAvailable ?? null),
		findHistory: jest.fn().mockResolvedValue([storedForecast()]),
		touchCheckedAt: jest.fn().mockImplementation(async (row, checkedAt) => ({ ...row, checkedAt })),
		create: jest.fn().mockImplementation((value) => value),
		save: jest
			.fn()
			.mockImplementation(async (value) => ({ id: "new-1", createdAt: NOW, ...value })),
	};
	const weatherProvider = {
		fetchCurrent: jest.fn(),
		fetchHourlyForecast: jest.fn().mockResolvedValue({
			hours: options.hours ?? [calmHour("2026-11-12T00:00:00Z")],
			raw: { provider: "open-meteo" },
		}),
	};
	const notifier = { notifyIfLevelChanged: jest.fn().mockResolvedValue([]) };
	const service = new TripWeatherForecastService(
		forecastsRepository as never,
		{ findActiveRule: jest.fn().mockResolvedValue(RULE) } as never,
		weatherProvider as never,
		{ generate: jest.fn() } as never,
		notifier as unknown as TripWeatherChangeNotifier
	);
	return { service, forecastsRepository, weatherProvider, notifier };
}

const host = { userId: "host-1", roles: ["host"], status: "active" } as AuthenticatedUser;

describe("Trip forecast history only on change", () => {
	it("an unchanged re-check only moves checked_at: no new row, no notice", async () => {
		const latest = storedForecast();
		const { service, forecastsRepository, notifier } = build({ latest });

		const result = await service.tryEnsureTripForecast("trip-1", NOW);

		expect(forecastsRepository.save).not.toHaveBeenCalled();
		expect(forecastsRepository.touchCheckedAt).toHaveBeenCalledWith(latest, NOW);
		expect(notifier.notifyIfLevelChanged).not.toHaveBeenCalled();
		expect(result?.id).toBe("stored-1");
	});

	it("still reuses a result confirmed within 10 minutes without calling the provider", async () => {
		const latest = storedForecast({ checkedAt: new Date(NOW.getTime() - 5 * 60 * 1000) });
		const { service, weatherProvider } = build({ latest });
		await service.tryEnsureTripForecast("trip-1", NOW);
		expect(weatherProvider.fetchHourlyForecast).not.toHaveBeenCalled();
	});

	it("stores a new row when the worst-hour values change, even at the same level", async () => {
		const latest = storedForecast();
		const { service, forecastsRepository, notifier } = build({
			latest,
			previousAvailable: latest,
			hours: [calmHour("2026-11-12T00:00:00Z", { rainfallMm: 2 })],
		});

		await service.tryEnsureTripForecast("trip-1", NOW);

		expect(forecastsRepository.save).toHaveBeenCalledTimes(1);
		expect(forecastsRepository.save.mock.calls[0][0]).toMatchObject({
			riskLevel: RiskLevel.GREEN,
			checkedAt: NOW,
		});
		expect(notifier.notifyIfLevelChanged).toHaveBeenCalledWith(
			expect.objectContaining({ id: "new-1" }),
			RiskLevel.GREEN
		);
	});

	it("stores a new row and hands the previous level to the notifier when the level changes", async () => {
		const latest = storedForecast();
		const { service, forecastsRepository, notifier } = build({
			latest,
			previousAvailable: latest,
			hours: [calmHour("2026-11-12T00:00:00Z"), stormHour],
		});

		await service.tryEnsureTripForecast("trip-1", NOW);

		expect(forecastsRepository.save.mock.calls[0][0].riskLevel).toBe(RiskLevel.RED);
		expect(notifier.notifyIfLevelChanged).toHaveBeenCalledWith(
			expect.objectContaining({ riskLevel: RiskLevel.RED }),
			RiskLevel.GREEN
		);
	});

	it("passes no previous level for the first forecast with a level", async () => {
		const { service, notifier } = build({ latest: null, previousAvailable: null });
		await service.tryEnsureTripForecast("trip-1", NOW);
		expect(notifier.notifyIfLevelChanged).toHaveBeenCalledWith(expect.anything(), null);
	});

	it("confirms a still-out-of-range result instead of adding rows", async () => {
		const latest = storedForecast({
			status: TripWeatherForecastStatus.OUT_OF_RANGE,
			riskLevel: null,
			worstReading: null,
			ruleVersionId: null,
			tripStartsAt: new Date("2026-12-20T00:00:00.000Z"),
			tripEndsAt: new Date("2026-12-20T10:00:00.000Z"),
		});
		const { service, forecastsRepository } = build({
			latest,
			trip: {
				startsAt: new Date("2026-12-20T00:00:00.000Z"),
				endsAt: new Date("2026-12-20T10:00:00.000Z"),
			},
		});
		await service.tryEnsureTripForecast("trip-1", NOW);
		expect(forecastsRepository.save).not.toHaveBeenCalled();
		expect(forecastsRepository.touchCheckedAt).toHaveBeenCalledWith(latest, NOW);
	});
});

describe("Raw provider data only for the forecast attachable at submission", () => {
	it("drops the raw response for a published Trip (monitoring and traveller checks)", async () => {
		const { service, forecastsRepository } = build();
		await service.tryEnsureTripForecast("trip-1", NOW);
		expect(forecastsRepository.save.mock.calls[0][0].providerResponse).toBeNull();
	});

	it.each(["draft", "pending_approval"])(
		"keeps it for a %s Trip the Host forecasts",
		async (status) => {
			const { service, forecastsRepository } = build({ trip: { status } });
			await service.forecastForTrip(host, "trip-1", NOW);
			expect(forecastsRepository.save.mock.calls[0][0].providerResponse).toEqual({
				provider: "open-meteo",
			});
		}
	);
});

describe("TripWeatherForecastService.getHistory access", () => {
	const actor = (userId: string, role: string) =>
		({ userId, roles: [role], status: "active" }) as AuthenticatedUser;

	it.each([
		["admin", actor("admin-1", "admin"), "draft"],
		["owning Host", actor("host-1", "host"), "draft"],
		["Camper on a published Trip", actor("camper-1", "camper"), "published"],
		["Porter on an ongoing Trip", actor("porter-1", "porter"), "ongoing"],
	])("allows the %s", async (_label, who, status) => {
		const { service, forecastsRepository } = build({ trip: { status } });
		const history = await service.getHistory(who, "trip-1");
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({ id: "stored-1", checkedAt: expect.any(Date) });
		expect(forecastsRepository.findHistory).toHaveBeenCalledWith("trip-1", 50);
	});

	it.each([
		["Camper on a draft Trip", actor("camper-1", "camper"), "draft"],
		["another Host", actor("host-2", "host"), "published"],
	])("hides the Trip from the %s", async (_label, who, status) => {
		const { service } = build({ trip: { status } });
		await expect(service.getHistory(who, "trip-1")).rejects.toBeInstanceOf(NotFoundException);
	});

	it("returns 404 for an absent Trip", async () => {
		const { service, forecastsRepository } = build();
		forecastsRepository.findTripForForecast.mockResolvedValue(null);
		await expect(service.getHistory(host, "trip-1")).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("TripWeatherChangeNotifier", () => {
	function notice(recipientId: string): TripWeatherChangeNoticeRow {
		return {
			id: `n-${recipientId}`,
			recipientId,
			tripId: "trip-1",
			forecastId: "new-1",
			tripTitle: "Sơn Trà",
			tripStartsAt: STARTS,
			previousRiskLevel: RiskLevel.GREEN,
			riskLevel: RiskLevel.RED,
			readAt: null,
			createdAt: NOW,
		};
	}

	function buildNotifier(created: TripWeatherChangeNoticeRow[]) {
		const notices = {
			findTripTitle: jest.fn().mockResolvedValue("Sơn Trà"),
			findRecipientIds: jest.fn().mockResolvedValue(["host-1", "camper-1", "camper-2"]),
			insertMany: jest.fn().mockResolvedValue(created),
		};
		const events = { emitTripWeatherChanged: jest.fn() };
		const notifier = new TripWeatherChangeNotifier(notices as never, events as never);
		return { notifier, notices, events };
	}

	const red = storedForecast({ id: "new-1", riskLevel: RiskLevel.RED });

	it("does nothing without a previous level or when the level is unchanged", async () => {
		const { notifier, notices } = buildNotifier([]);
		await notifier.notifyIfLevelChanged(red, null);
		await notifier.notifyIfLevelChanged(red, RiskLevel.RED);
		expect(notices.insertMany).not.toHaveBeenCalled();
	});

	it("stores one notice per recipient and pushes only to the ones newly created", async () => {
		const { notifier, notices, events } = buildNotifier([notice("host-1"), notice("camper-1")]);

		const created = await notifier.notifyIfLevelChanged(red, RiskLevel.GREEN);

		expect(notices.insertMany).toHaveBeenCalledWith({
			recipientIds: ["host-1", "camper-1", "camper-2"],
			tripId: "trip-1",
			forecastId: "new-1",
			tripTitle: "Sơn Trà",
			tripStartsAt: STARTS,
			previousRiskLevel: RiskLevel.GREEN,
			riskLevel: RiskLevel.RED,
		});
		expect(created).toHaveLength(2);
		expect(events.emitTripWeatherChanged).toHaveBeenCalledWith(
			["host-1", "camper-1"],
			expect.objectContaining({
				eventId: "new-1",
				previousRiskLevel: RiskLevel.GREEN,
				riskLevel: RiskLevel.RED,
			})
		);
	});

	it("emits nothing when every recipient was already notified (retry)", async () => {
		const { notifier, events } = buildNotifier([]);
		await notifier.notifyIfLevelChanged(red, RiskLevel.GREEN);
		expect(events.emitTripWeatherChanged).not.toHaveBeenCalled();
	});

	it("never throws into the forecast flow", async () => {
		const { notifier, notices } = buildNotifier([]);
		notices.insertMany.mockRejectedValue(new Error("db down"));
		await expect(notifier.notifyIfLevelChanged(red, RiskLevel.GREEN)).resolves.toEqual([]);
	});
});

describe("Weather change notice wording (policy §4)", () => {
	it("warns early when the forecast worsens and reassures when it improves", () => {
		expect(weatherChangeMessage(RiskLevel.GREEN, RiskLevel.RED, STARTS)).toBe(
			"Cảnh báo sớm: dự báo ngày 12/11 xấu đi (Xanh → Đỏ), đang theo dõi."
		);
		expect(weatherChangeMessage(RiskLevel.RED, RiskLevel.GREEN, STARTS)).toBe(
			"Dự báo ngày 12/11 đã cải thiện (Đỏ → Xanh)."
		);
	});

	it("marks a worsening notice and keeps read state", () => {
		const dto = toTripWeatherChangeNoticeDto({
			id: "n-1",
			recipientId: "camper-1",
			tripId: "trip-1",
			forecastId: "f-1",
			tripTitle: "Sơn Trà",
			tripStartsAt: STARTS,
			previousRiskLevel: RiskLevel.YELLOW,
			riskLevel: RiskLevel.RED,
			readAt: null,
			createdAt: NOW,
		});
		expect(dto).toMatchObject({ worsened: true, readAt: null });
	});
});

describe("TripWeatherMonitorService", () => {
	function buildMonitor(dueIds: string[], forecastFor: (id: string) => unknown) {
		const forecastsRepository = {
			findDueTripIds: jest.fn().mockResolvedValue(dueIds),
			deleteEndedTripHistory: jest.fn().mockResolvedValue(3),
		};
		const forecastService = {
			tryEnsureTripForecast: jest.fn(async (id: string) => forecastFor(id)),
		};
		const monitor = new TripWeatherMonitorService(
			forecastsRepository as never,
			forecastService as never
		);
		return { monitor, forecastsRepository, forecastService };
	}

	it("asks for due Trips with the policy cadence and re-forecasts each one in turn", async () => {
		const { monitor, forecastsRepository, forecastService } = buildMonitor(["a", "b", "c"], (id) =>
			id === "b" ? null : { id }
		);

		const result = await monitor.checkDueTrips(25, NOW);

		expect(forecastsRepository.findDueTripIds).toHaveBeenCalledWith(NOW, {
			horizonMs: 15 * 24 * 60 * 60 * 1000,
			nearWindowMs: TRIP_WEATHER_MONITOR_NEAR_WINDOW_MS,
			nearIntervalMs: TRIP_WEATHER_MONITOR_NEAR_INTERVAL_MS,
			farIntervalMs: TRIP_WEATHER_MONITOR_FAR_INTERVAL_MS,
			limit: 25,
		});
		expect(TRIP_WEATHER_MONITOR_NEAR_WINDOW_MS).toBe(3 * 24 * 60 * 60 * 1000);
		expect(TRIP_WEATHER_MONITOR_NEAR_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
		expect(TRIP_WEATHER_MONITOR_FAR_INTERVAL_MS).toBe(24 * 60 * 60 * 1000);
		expect(forecastService.tryEnsureTripForecast.mock.calls.map((call) => call[0])).toEqual([
			"a",
			"b",
			"c",
		]);
		expect(result).toEqual({ checked: 3, failed: 1 });
	});

	it("trims history of Trips that ended more than 30 days ago", async () => {
		const { monitor, forecastsRepository } = buildMonitor([], () => null);
		await expect(monitor.trimEndedTripHistory(NOW)).resolves.toBe(3);
		expect(forecastsRepository.deleteEndedTripHistory).toHaveBeenCalledWith(
			new Date(NOW.getTime() - TRIP_WEATHER_HISTORY_RETENTION_MS)
		);
		expect(TRIP_WEATHER_HISTORY_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
	});
});

describe("TripWeatherMonitorWorker", () => {
	function buildWorker(env: Record<string, string>) {
		const config = { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;
		const monitor = {
			checkDueTrips: jest.fn().mockResolvedValue({ checked: 0, failed: 0 }),
			trimEndedTripHistory: jest.fn().mockResolvedValue(0),
		};
		return { worker: new TripWeatherMonitorWorker(config, monitor as never), monitor };
	}

	it("stays idle unless explicitly enabled", () => {
		const { worker, monitor } = buildWorker({});
		worker.onApplicationBootstrap();
		expect(monitor.checkDueTrips).not.toHaveBeenCalled();
	});

	it("checks due Trips every tick and trims history at most once a day", async () => {
		const { worker, monitor } = buildWorker({ TRIP_WEATHER_MONITOR_BATCH_SIZE: "10" });
		await worker.startTick(() => NOW);
		await worker.startTick(() => new Date(NOW.getTime() + 60 * 60 * 1000));
		await worker.startTick(() => new Date(NOW.getTime() + 25 * 60 * 60 * 1000));

		expect(monitor.checkDueTrips).toHaveBeenCalledTimes(3);
		expect(monitor.checkDueTrips).toHaveBeenCalledWith(10, NOW);
		expect(monitor.trimEndedTripHistory).toHaveBeenCalledTimes(2);
		await worker.onApplicationShutdown();
	});

	it("keeps running after a failed tick", async () => {
		const { worker, monitor } = buildWorker({});
		monitor.checkDueTrips.mockRejectedValueOnce(new Error("provider down"));
		await worker.startTick(() => NOW);
		await worker.startTick(() => NOW);
		expect(monitor.checkDueTrips).toHaveBeenCalledTimes(2);
	});
});
