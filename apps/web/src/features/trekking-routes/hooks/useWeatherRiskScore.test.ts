import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherRiskAssessment } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type WeatherRiskScoreModule = typeof import("./useWeatherRiskScore");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let weatherRiskScoreModule: WeatherRiskScoreModule;
let HttpError: HttpErrorConstructor;
let getLatestWeatherRiskMock: ReturnType<typeof vi.fn>;
let calculateWeatherRiskMock: ReturnType<typeof vi.fn>;

const assessmentFixture = {
	id: "assess-1",
	routeId: "route-id",
	snapshotId: "snap-1",
	ruleVersionId: "rule-1",
	riskLevel: "green",
	compositeScore: 0.1,
	criteriaScores: {} as never,
	createdBy: "user-1",
	createdAt: "2026-08-30T15:24:24.000Z",
} as WeatherRiskAssessment;

describe("useWeatherRiskScore", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		getLatestWeatherRiskMock = vi.fn();
		calculateWeatherRiskMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: {
				getLatestWeatherRisk: getLatestWeatherRiskMock,
				calculateWeatherRisk: calculateWeatherRiskMock,
			},
		}));

		[testingLibrary, weatherRiskScoreModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useWeatherRiskScore"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("fires no request when routeId is undefined", async () => {
		const { result } = testingLibrary.renderHook(() =>
			weatherRiskScoreModule.useWeatherRiskScore()
		);

		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(getLatestWeatherRiskMock).not.toHaveBeenCalled();
		expect(result.current.assessment).toBeNull();
	});

	it("loads the latest assessment for a routeId", async () => {
		getLatestWeatherRiskMock.mockResolvedValue(assessmentFixture);
		const { result } = testingLibrary.renderHook(() =>
			weatherRiskScoreModule.useWeatherRiskScore("route-id")
		);

		await testingLibrary.waitFor(() =>
			expect(result.current.assessment).toEqual(assessmentFixture)
		);
		expect(getLatestWeatherRiskMock).toHaveBeenCalledWith("route-id");
	});

	it("returns null if no assessment exists", async () => {
		getLatestWeatherRiskMock.mockResolvedValue(null);
		const { result } = testingLibrary.renderHook(() =>
			weatherRiskScoreModule.useWeatherRiskScore("route-id")
		);

		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.assessment).toBeNull();
		expect(result.current.error).toBe("");
	});

	it("maps a load failure to a Vietnamese message", async () => {
		getLatestWeatherRiskMock.mockRejectedValue(new Error("network error"));
		const { result } = testingLibrary.renderHook(() =>
			weatherRiskScoreModule.useWeatherRiskScore("route-id")
		);

		await testingLibrary.waitFor(() => expect(result.current.error).not.toBe(""));
		expect(result.current.assessment).toBeNull();
	});

	it("calculate calls service and updates assessment", async () => {
		calculateWeatherRiskMock.mockResolvedValue(assessmentFixture);
		const { result } = testingLibrary.renderHook(() =>
			weatherRiskScoreModule.useWeatherRiskScore("route-id")
		);

		let returned: unknown;
		await testingLibrary.act(async () => {
			returned = await result.current.calculate();
		});

		expect(calculateWeatherRiskMock).toHaveBeenCalledWith("route-id");
		expect(returned).toEqual(assessmentFixture);
		expect(result.current.assessment).toEqual(assessmentFixture);
		expect(result.current.calculateError).toBeNull();
	});

	it("prevents duplicate calculate requests while one is in flight", async () => {
		let resolve!: (value: WeatherRiskAssessment) => void;
		calculateWeatherRiskMock.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
		const { result } = testingLibrary.renderHook(() =>
			weatherRiskScoreModule.useWeatherRiskScore("route-id")
		);

		let first!: Promise<unknown>;
		testingLibrary.act(() => {
			first = result.current.calculate();
		});
		expect(result.current.isCalculating).toBe(true);

		expect(await result.current.calculate()).toBeNull();

		resolve(assessmentFixture);
		await testingLibrary.act(async () => first);

		expect(calculateWeatherRiskMock).toHaveBeenCalledTimes(1);
		expect(result.current.isCalculating).toBe(false);
	});

	it.each([401, 403, 404, 409])(
		"maps calculation API error %s to Vietnamese message",
		async (status) => {
			calculateWeatherRiskMock.mockRejectedValue(new HttpError("failure", status, {}));
			const { result } = testingLibrary.renderHook(() =>
				weatherRiskScoreModule.useWeatherRiskScore("route-id")
			);

			await testingLibrary.act(async () => {
				await result.current.calculate();
			});

			expect(result.current.calculateError).toEqual(
				expect.objectContaining({ status, message: expect.any(String) })
			);
		}
	);

	it("resetCalculateError clears previous calculate error", async () => {
		calculateWeatherRiskMock.mockRejectedValue(new HttpError("failure", 409, {}));
		const { result } = testingLibrary.renderHook(() =>
			weatherRiskScoreModule.useWeatherRiskScore("route-id")
		);

		await testingLibrary.act(async () => {
			await result.current.calculate();
		});
		expect(result.current.calculateError).not.toBeNull();

		testingLibrary.act(() => result.current.resetCalculateError());
		expect(result.current.calculateError).toBeNull();
	});
});
