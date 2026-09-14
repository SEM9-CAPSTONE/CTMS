import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateTrekkingRoute } from "../hooks/useCreateTrekkingRoute";
import { CreateTrekkingRoutePage } from "./CreateTrekkingRoutePage";

vi.mock("../hooks/useCreateTrekkingRoute", () => ({ useCreateTrekkingRoute: vi.fn() }));
vi.mock("../components/CreateTrekkingRouteForm", () => ({
	CreateTrekkingRouteForm: () => <div data-testid="route-form" />,
}));

const creation = {
	isSubmitting: false,
	error: null,
	createdRoute: null,
	submit: vi.fn(),
	retry: vi.fn(),
	reset: vi.fn(),
};

describe("CreateTrekkingRoutePage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useCreateTrekkingRoute).mockReturnValue(creation as never);
	});

	it("shows the route creation form immediately", () => {
		render(<CreateTrekkingRoutePage />);
		expect(screen.getByTestId("route-form")).toBeInTheDocument();
	});

	it("renders authoritative server length and status after success", () => {
		vi.mocked(useCreateTrekkingRoute).mockReturnValue({
			...creation,
			createdRoute: { name: "Ridge", status: "draft", lengthMeters: 1234.56, difficulty: "hard" },
		} as never);
		render(<CreateTrekkingRoutePage />);
		expect(screen.getByTestId("server-route-status")).toHaveTextContent("draft");
		expect(screen.getByTestId("server-route-length")).toHaveTextContent("1234.6 m");
	});
});
