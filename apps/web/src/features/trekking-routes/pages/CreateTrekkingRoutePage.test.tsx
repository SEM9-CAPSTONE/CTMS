import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateTrekkingRoute } from "../hooks/useCreateTrekkingRoute";
import { useOwnedCampsites } from "../hooks/useOwnedCampsites";
import { CreateTrekkingRoutePage } from "./CreateTrekkingRoutePage";

vi.mock("../hooks/useOwnedCampsites", () => ({ useOwnedCampsites: vi.fn() }));
vi.mock("../hooks/useCreateTrekkingRoute", () => ({ useCreateTrekkingRoute: vi.fn() }));
vi.mock("../components/CreateTrekkingRouteForm", () => ({
	CreateTrekkingRouteForm: ({ initialCampsiteId }: { initialCampsiteId?: string }) => (
		<div data-testid="route-form" data-initial-campsite-id={initialCampsiteId ?? ""} />
	),
}));

const creation = {
	isSubmitting: false,
	error: null,
	createdRoute: null,
	submit: vi.fn(),
	retry: vi.fn(),
	reset: vi.fn(),
};
const campsite = { id: "c1", name: "Pine Camp" };

describe("CreateTrekkingRoutePage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.history.replaceState({}, "", "/host/trekking-routes/create");
		vi.mocked(useCreateTrekkingRoute).mockReturnValue(creation as never);
	});
	it("shows campsite loading", () => {
		vi.mocked(useOwnedCampsites).mockReturnValue({
			items: [],
			isLoading: true,
			error: "",
			retry: vi.fn(),
		} as never);
		render(<CreateTrekkingRoutePage />);
		expect(screen.getByTestId("campsites-loading")).toBeInTheDocument();
	});
	it("shows error and retries", () => {
		const retry = vi.fn();
		vi.mocked(useOwnedCampsites).mockReturnValue({
			items: [],
			isLoading: false,
			error: "load failed",
			retry,
		} as never);
		render(<CreateTrekkingRoutePage />);
		fireEvent.click(screen.getByRole("button", { name: /Tải lại/i }));
		expect(retry).toHaveBeenCalled();
	});
	it("shows empty state", () => {
		vi.mocked(useOwnedCampsites).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		} as never);
		render(<CreateTrekkingRoutePage />);
		expect(screen.getByTestId("campsites-empty")).toBeInTheDocument();
	});
	it("shows form when campsites exist", () => {
		vi.mocked(useOwnedCampsites).mockReturnValue({
			items: [campsite],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		} as never);
		render(<CreateTrekkingRoutePage />);
		expect(screen.getByTestId("route-form")).toBeInTheDocument();
		expect(screen.getByTestId("route-form")).toHaveAttribute("data-initial-campsite-id", "");
	});
	it("preselects a requested campsite only when it belongs to the loaded owned list", () => {
		window.history.replaceState({}, "", "/host/trekking-routes/create?campsiteId=c1");
		vi.mocked(useOwnedCampsites).mockReturnValue({
			items: [campsite],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		} as never);
		render(<CreateTrekkingRoutePage />);
		expect(screen.getByTestId("route-form")).toHaveAttribute("data-initial-campsite-id", "c1");
	});
	it("ignores an unknown requested campsite", () => {
		window.history.replaceState({}, "", "/host/trekking-routes/create?campsiteId=not-owned");
		vi.mocked(useOwnedCampsites).mockReturnValue({
			items: [campsite],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		} as never);
		render(<CreateTrekkingRoutePage />);
		expect(screen.getByTestId("route-form")).toHaveAttribute("data-initial-campsite-id", "");
	});
	it("renders authoritative server length and status after success", () => {
		vi.mocked(useOwnedCampsites).mockReturnValue({
			items: [campsite],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		} as never);
		vi.mocked(useCreateTrekkingRoute).mockReturnValue({
			...creation,
			createdRoute: { name: "Ridge", status: "draft", lengthMeters: 1234.56, difficulty: "hard" },
		} as never);
		render(<CreateTrekkingRoutePage />);
		expect(screen.getByTestId("server-route-status")).toHaveTextContent("draft");
		expect(screen.getByTestId("server-route-length")).toHaveTextContent("1234.6 m");
	});
});
