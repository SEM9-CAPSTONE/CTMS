import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherAdvice } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type WeatherAdviceModule = typeof import("./useWeatherAdvice");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let weatherAdviceModule: WeatherAdviceModule;
let HttpError: HttpErrorConstructor;
let getLatestWeatherAdviceMock: ReturnType<typeof vi.fn>;
let generateWeatherAdviceMock: ReturnType<typeof vi.fn>;

const adviceFixture = {
	id: "advice-1",
	assessmentId: "assess-1",
	adviceText: "Điều kiện ở mức cảnh báo nhẹ, nên chuẩn bị áo mưa.",
	actions: ["Mang áo mưa", "Theo dõi dự báo trước giờ khởi hành"],
	createdBy: "user-1",
	createdAt: "2026-08-30T15:24:24.000Z",
} as WeatherAdvice;

describe("useWeatherAdvice", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		getLatestWeatherAdviceMock = vi.fn();
		generateWeatherAdviceMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: {
				getLatestWeatherAdvice: getLatestWeatherAdviceMock,
				generateWeatherAdvice: generateWeatherAdviceMock,
			},
		}));

		[testingLibrary, weatherAdviceModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useWeatherAdvice"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("fires no request when routeId is undefined", async () => {
		const { result } = testingLibrary.renderHook(() => weatherAdviceModule.useWeatherAdvice());

		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(getLatestWeatherAdviceMock).not.toHaveBeenCalled();
		expect(result.current.advice).toBeNull();
	});

	it("loads the latest advice for a routeId", async () => {
		getLatestWeatherAdviceMock.mockResolvedValue(adviceFixture);
		const { result } = testingLibrary.renderHook(() =>
			weatherAdviceModule.useWeatherAdvice("route-id")
		);

		await testingLibrary.waitFor(() => expect(result.current.advice).toEqual(adviceFixture));
		expect(getLatestWeatherAdviceMock).toHaveBeenCalledWith("route-id");
	});

	it("returns null if no advice exists", async () => {
		getLatestWeatherAdviceMock.mockResolvedValue(null);
		const { result } = testingLibrary.renderHook(() =>
			weatherAdviceModule.useWeatherAdvice("route-id")
		);

		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.advice).toBeNull();
		expect(result.current.error).toBe("");
	});

	it("maps a load failure to a Vietnamese message", async () => {
		getLatestWeatherAdviceMock.mockRejectedValue(new Error("network error"));
		const { result } = testingLibrary.renderHook(() =>
			weatherAdviceModule.useWeatherAdvice("route-id")
		);

		await testingLibrary.waitFor(() => expect(result.current.error).not.toBe(""));
		expect(result.current.advice).toBeNull();
	});

	it("generate calls service and updates advice", async () => {
		generateWeatherAdviceMock.mockResolvedValue(adviceFixture);
		const { result } = testingLibrary.renderHook(() =>
			weatherAdviceModule.useWeatherAdvice("route-id")
		);

		let returned: unknown;
		await testingLibrary.act(async () => {
			returned = await result.current.generate();
		});

		expect(generateWeatherAdviceMock).toHaveBeenCalledWith("route-id");
		expect(returned).toEqual(adviceFixture);
		expect(result.current.advice).toEqual(adviceFixture);
		expect(result.current.generateError).toBeNull();
	});

	it("prevents duplicate generate requests while one is in flight", async () => {
		let resolve!: (value: WeatherAdvice) => void;
		generateWeatherAdviceMock.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
		const { result } = testingLibrary.renderHook(() =>
			weatherAdviceModule.useWeatherAdvice("route-id")
		);

		let first!: Promise<unknown>;
		testingLibrary.act(() => {
			first = result.current.generate();
		});
		expect(result.current.isGenerating).toBe(true);

		expect(await result.current.generate()).toBeNull();

		resolve(adviceFixture);
		await testingLibrary.act(async () => first);

		expect(generateWeatherAdviceMock).toHaveBeenCalledTimes(1);
		expect(result.current.isGenerating).toBe(false);
	});

	it.each([401, 403, 404, 409, 503])(
		"maps generate API error %s to Vietnamese message",
		async (status) => {
			generateWeatherAdviceMock.mockRejectedValue(new HttpError("failure", status, {}));
			const { result } = testingLibrary.renderHook(() =>
				weatherAdviceModule.useWeatherAdvice("route-id")
			);

			await testingLibrary.act(async () => {
				await result.current.generate();
			});

			expect(result.current.generateError).toEqual(
				expect.objectContaining({ status, message: expect.any(String) })
			);
		}
	);

	it("resetGenerateError clears previous generate error", async () => {
		generateWeatherAdviceMock.mockRejectedValue(new HttpError("failure", 409, {}));
		const { result } = testingLibrary.renderHook(() =>
			weatherAdviceModule.useWeatherAdvice("route-id")
		);

		await testingLibrary.act(async () => {
			await result.current.generate();
		});
		expect(result.current.generateError).not.toBeNull();

		testingLibrary.act(() => result.current.resetGenerateError());
		expect(result.current.generateError).toBeNull();
	});
});
