import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type TrekkingRoutesModule = typeof import("./useTrekkingRoutes");

let testingLibrary: TestingLibrary;
let trekkingRoutesModule: TrekkingRoutesModule;
let listByCampsiteMock: ReturnType<typeof vi.fn>;

const activeRoute = { id: "route-id", status: "active" } as CreatedTrekkingRoute;
const closedRoute = { id: "route-id", status: "closed" } as CreatedTrekkingRoute;

describe("useTrekkingRoutes", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		listByCampsiteMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: { listByCampsite: listByCampsiteMock },
		}));

		[testingLibrary, trekkingRoutesModule] = await Promise.all([
			import("@testing-library/react"),
			import("./useTrekkingRoutes"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("keeps the selected collection stable until an authoritative reload completes", async () => {
		let resolveReload!: (routes: CreatedTrekkingRoute[]) => void;
		listByCampsiteMock.mockResolvedValueOnce([activeRoute]).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveReload = resolve;
				})
		);
		const { result } = testingLibrary.renderHook(() =>
			trekkingRoutesModule.useTrekkingRoutes("campsite-id")
		);
		await testingLibrary.waitFor(() => expect(result.current.items).toEqual([activeRoute]));

		let reload!: Promise<void>;
		testingLibrary.act(() => {
			reload = result.current.retry();
		});
		expect(result.current.items).toEqual([activeRoute]);
		resolveReload([closedRoute]);
		await testingLibrary.act(async () => reload);

		expect(result.current.items).toEqual([closedRoute]);
	});
});
