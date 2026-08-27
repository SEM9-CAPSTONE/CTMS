import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute, RouteStatus } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type UserEvent = typeof import("@testing-library/user-event").default;
type RouteStatusActionDialogComponent = typeof import(
	"./RouteStatusActionDialog"
).RouteStatusActionDialog;
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let userEvent: UserEvent;
let RouteStatusActionDialog: RouteStatusActionDialogComponent;
let HttpError: HttpErrorConstructor;
let closeMock: ReturnType<typeof vi.fn>;
let reopenMock: ReturnType<typeof vi.fn>;

function route(status: RouteStatus): CreatedTrekkingRoute {
	return {
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		campsiteId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		name: "Ridge route",
		description: null,
		geometry: {
			type: "LineString",
			coordinates: [
				[108.45, 11.94],
				[108.47, 11.95],
			],
		},
		lengthMeters: 1000,
		difficulty: "moderate",
		expectedDurationMinutes: 120,
		status,
		createdAt: "2026-08-27T00:00:00.000Z",
		updatedAt: "2026-08-27T00:00:00.000Z",
	};
}

describe("RouteStatusActionDialog", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		closeMock = vi.fn();
		reopenMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: { close: closeMock, reopen: reopenMock },
		}));

		[testingLibrary, { default: userEvent }, { RouteStatusActionDialog }, { HttpError }] =
			await Promise.all([
				import("@testing-library/react"),
				import("@testing-library/user-event"),
				import("./RouteStatusActionDialog"),
				import("../../../core/api"),
			]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("shows only the lifecycle action allowed by the authoritative route status", () => {
		const { rerender } = testingLibrary.render(
			<RouteStatusActionDialog route={route("active")} onReload={vi.fn()} />
		);
		expect(
			testingLibrary.screen.getByRole("button", { name: "Đóng tuyến đường" })
		).toBeInTheDocument();

		rerender(<RouteStatusActionDialog route={route("closed")} onReload={vi.fn()} />);
		expect(
			testingLibrary.screen.getByRole("button", { name: "Mở lại tuyến đường" })
		).toBeInTheDocument();
		expect(
			testingLibrary.screen.queryByRole("button", { name: "Đóng tuyến đường" })
		).not.toBeInTheDocument();

		rerender(<RouteStatusActionDialog route={route("pending_approval")} onReload={vi.fn()} />);
		expect(
			testingLibrary.screen.queryByRole("button", { name: /tuyến đường/ })
		).not.toBeInTheDocument();
		rerender(<RouteStatusActionDialog route={route("draft")} onReload={vi.fn()} />);
		expect(
			testingLibrary.screen.queryByRole("button", { name: /tuyến đường/ })
		).not.toBeInTheDocument();
	});

	it("opens, validates a required reason, and cancels without a request", async () => {
		const user = userEvent.setup();
		testingLibrary.render(<RouteStatusActionDialog route={route("active")} onReload={vi.fn()} />);
		await user.click(testingLibrary.screen.getByRole("button", { name: "Đóng tuyến đường" }));
		const dialog = testingLibrary.screen.getByRole("dialog");

		await user.click(
			testingLibrary.within(dialog).getByRole("button", { name: "Đóng tuyến đường" })
		);
		expect(
			await testingLibrary.within(dialog).findByText(/Vui lòng nhập lý do/)
		).toBeInTheDocument();
		await user.type(testingLibrary.within(dialog).getByLabelText("Lý do"), "   ");
		await user.click(
			testingLibrary.within(dialog).getByRole("button", { name: "Đóng tuyến đường" })
		);
		expect(closeMock).not.toHaveBeenCalled();

		await user.click(testingLibrary.within(dialog).getByRole("button", { name: "Hủy" }));
		expect(testingLibrary.screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("keeps the reason and dialog open for API errors", async () => {
		const user = userEvent.setup();
		closeMock.mockRejectedValue(
			new HttpError("conflict", 409, { message: "Route changed concurrently" })
		);
		testingLibrary.render(<RouteStatusActionDialog route={route("active")} onReload={vi.fn()} />);
		await user.click(testingLibrary.screen.getByRole("button", { name: "Đóng tuyến đường" }));
		const dialog = testingLibrary.screen.getByRole("dialog");
		const reason = testingLibrary.within(dialog).getByLabelText("Lý do");
		await user.type(reason, "Heavy rain");
		await user.click(
			testingLibrary.within(dialog).getByRole("button", { name: "Đóng tuyến đường" })
		);

		expect(await testingLibrary.within(dialog).findByRole("alert")).toHaveTextContent(
			"Route changed concurrently"
		);
		expect(reason).toHaveValue("Heavy rain");
		expect(testingLibrary.screen.getByRole("dialog")).toBeInTheDocument();
	});

	it("accepts 255 reason characters and rejects more than 255", async () => {
		const user = userEvent.setup();
		closeMock.mockResolvedValue(route("closed"));
		const onReload = vi.fn().mockResolvedValue(undefined);
		testingLibrary.render(<RouteStatusActionDialog route={route("active")} onReload={onReload} />);
		await user.click(testingLibrary.screen.getByRole("button", { name: "Đóng tuyến đường" }));
		const dialog = testingLibrary.screen.getByRole("dialog");
		const reason = testingLibrary.within(dialog).getByLabelText("Lý do");
		expect(reason).toHaveAttribute("maxLength", "255");

		testingLibrary.fireEvent.change(reason, { target: { value: "x".repeat(256) } });
		await user.click(
			testingLibrary.within(dialog).getByRole("button", { name: "Đóng tuyến đường" })
		);
		expect(await testingLibrary.within(dialog).findByText(/255 ký tự/)).toBeInTheDocument();
		expect(closeMock).not.toHaveBeenCalled();

		testingLibrary.fireEvent.change(reason, { target: { value: "x".repeat(255) } });
		await user.click(
			testingLibrary.within(dialog).getByRole("button", { name: "Đóng tuyến đường" })
		);
		await testingLibrary.waitFor(() =>
			expect(closeMock).toHaveBeenCalledWith(route("active").id, { reason: "x".repeat(255) })
		);
		expect(onReload).toHaveBeenCalledTimes(1);
	});

	it("shows loading, blocks duplicates, and reloads authoritative data after close", async () => {
		const user = userEvent.setup();
		let resolve!: (value: CreatedTrekkingRoute) => void;
		closeMock.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
		const onReload = vi.fn().mockResolvedValue(undefined);
		testingLibrary.render(<RouteStatusActionDialog route={route("active")} onReload={onReload} />);
		await user.click(testingLibrary.screen.getByRole("button", { name: "Đóng tuyến đường" }));
		const dialog = testingLibrary.screen.getByRole("dialog");
		await user.type(testingLibrary.within(dialog).getByLabelText("Lý do"), "Heavy rain");
		await user.click(
			testingLibrary.within(dialog).getByRole("button", { name: "Đóng tuyến đường" })
		);

		const pending = testingLibrary.within(dialog).getByRole("button", { name: "Đang đóng..." });
		expect(pending).toBeDisabled();
		await user.click(pending);
		expect(closeMock).toHaveBeenCalledTimes(1);
		resolve(route("closed"));

		await testingLibrary.waitFor(() => expect(onReload).toHaveBeenCalledTimes(1));
		await testingLibrary.waitFor(() =>
			expect(testingLibrary.screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
	});

	it("reopens through the dedicated endpoint and reloads before closing", async () => {
		const user = userEvent.setup();
		reopenMock.mockResolvedValue(route("pending_approval"));
		const onReload = vi.fn().mockResolvedValue(undefined);
		testingLibrary.render(<RouteStatusActionDialog route={route("closed")} onReload={onReload} />);
		await user.click(testingLibrary.screen.getByRole("button", { name: "Mở lại tuyến đường" }));
		const dialog = testingLibrary.screen.getByRole("dialog");
		await user.type(testingLibrary.within(dialog).getByLabelText("Lý do"), "Inspection complete");
		await user.click(
			testingLibrary.within(dialog).getByRole("button", { name: "Mở lại tuyến đường" })
		);

		await testingLibrary.waitFor(() =>
			expect(reopenMock).toHaveBeenCalledWith(route("closed").id, {
				reason: "Inspection complete",
			})
		);
		expect(onReload).toHaveBeenCalledTimes(1);
	});
});
