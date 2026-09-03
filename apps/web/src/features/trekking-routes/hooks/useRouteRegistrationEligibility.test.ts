import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { mapRegistrationEligibilityError } from "./useRouteRegistrationEligibility";

type TestingLibrary = typeof import("@testing-library/react");
type UseRouteRegistrationEligibilityHook = typeof import(
	"./useRouteRegistrationEligibility"
).useRouteRegistrationEligibility;

let testingLibrary: TestingLibrary;
let useRouteRegistrationEligibility: UseRouteRegistrationEligibilityHook;
let checkRegistrationEligibilityMock: ReturnType<typeof vi.fn>;

describe("mapRegistrationEligibilityError", () => {
	it("returns fallback message for unknown error", () => {
		const result = mapRegistrationEligibilityError(new Error("Network fail"), "Fallback");
		expect(result).toEqual({ message: "Fallback" });
	});

	it("maps 409 Conflict payload with eligibilityData when registration is blocked", () => {
		const httpErr = new HttpError("Conflict", 409, {
			statusCode: 409,
			message: "New registrations are blocked because route weather risk is RED",
			allowed: false,
			routeId: "route-1",
			riskLevel: "red",
			assessmentTime: "2026-09-03T12:00:00.000Z",
			compositeScore: 1.5,
			reasons: [
				{
					criterion: "rainfall",
					level: "red",
					value: 80,
					message: "Rainfall (80mm) exceeds Red threshold",
				},
			],
		});

		const result = mapRegistrationEligibilityError(httpErr, "Fallback");

		expect(result.status).toBe(409);
		expect(result.message).toBe("New registrations are blocked because route weather risk is RED");
		expect(result.eligibilityData).toEqual({
			allowed: false,
			routeId: "route-1",
			riskLevel: "red",
			assessmentTime: "2026-09-03T12:00:00.000Z",
			compositeScore: 1.5,
			reasons: [
				{
					criterion: "rainfall",
					level: "red",
					value: 80,
					message: "Rainfall (80mm) exceeds Red threshold",
				},
			],
		});
	});
});

describe("useRouteRegistrationEligibility", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		checkRegistrationEligibilityMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: {
				checkRegistrationEligibility: checkRegistrationEligibilityMock,
			},
		}));

		[testingLibrary, { useRouteRegistrationEligibility }] = await Promise.all([
			import("@testing-library/react"),
			import("./useRouteRegistrationEligibility"),
		]);
	});

	afterEach(() => {
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("returns null eligibility when no routeId is provided", async () => {
		const { result } = testingLibrary.renderHook(() => useRouteRegistrationEligibility());

		expect(result.current.isLoading).toBe(false);
		expect(result.current.eligibility).toBeNull();
		expect(result.current.isBlocked).toBe(false);
	});

	it("loads allowed eligibility status when risk level is GREEN", async () => {
		const mockResponse = {
			allowed: true,
			routeId: "route-1",
			riskLevel: "green" as const,
			assessmentTime: "2026-09-03T10:00:00.000Z",
			compositeScore: 0.2,
			reasons: [],
		};

		checkRegistrationEligibilityMock.mockResolvedValue(mockResponse);

		const { result } = testingLibrary.renderHook(() => useRouteRegistrationEligibility("route-1"));

		await testingLibrary.waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.eligibility).toEqual(mockResponse);
		expect(result.current.isBlocked).toBe(false);
		expect(result.current.blockedReasons).toEqual([]);
		expect(result.current.error).toBe("");
	});

	it("handles blocked eligibility when API throws 409 Conflict with RED risk reasons", async () => {
		const httpErr = new HttpError("Conflict", 409, {
			statusCode: 409,
			message: "New registrations are blocked because route weather risk is RED",
			allowed: false,
			routeId: "route-1",
			riskLevel: "red",
			assessmentTime: "2026-09-03T12:00:00.000Z",
			compositeScore: 1.5,
			reasons: [
				{
					criterion: "rainfall",
					level: "red",
					value: 80,
					message: "Rainfall (80mm) exceeds Red threshold",
				},
				{
					criterion: "wind",
					level: "red",
					value: 85,
					message: "Wind speed (85km/h) exceeds Red threshold",
				},
			],
		});

		checkRegistrationEligibilityMock.mockRejectedValue(httpErr);

		const { result } = testingLibrary.renderHook(() => useRouteRegistrationEligibility("route-1"));

		await testingLibrary.waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.isBlocked).toBe(true);
		expect(result.current.blockedReasons).toHaveLength(2);
		expect(result.current.assessmentTime).toBe("2026-09-03T12:00:00.000Z");
	});

	it("allows manual re-check via reload()", async () => {
		checkRegistrationEligibilityMock.mockResolvedValue({
			allowed: true,
			routeId: "route-1",
			riskLevel: "green",
			assessmentTime: "2026-09-03T10:00:00.000Z",
			compositeScore: 0.1,
			reasons: [],
		});

		const { result } = testingLibrary.renderHook(() => useRouteRegistrationEligibility("route-1"));

		await testingLibrary.waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		await testingLibrary.act(async () => {
			await result.current.reload();
		});

		expect(checkRegistrationEligibilityMock).toHaveBeenCalledTimes(2);
	});
});
