import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { weatherDecisionsService } from "../../weather-decisions/services/weather-decisions.service";
import type { weatherPenaltiesService } from "../../weather-penalties/services/weather-penalties.service";
import { AdminWeatherManagementPage, adminWeatherTabUrl } from "./AdminWeatherManagementPage";

vi.mock("../../admin-layout/components/AdminLayout", () => ({
	AdminLayout: ({ children, activeItem }: { children: React.ReactNode; activeItem: string }) => (
		<div data-testid="admin-layout" data-active={activeItem}>
			{children}
		</div>
	),
}));

function decisions(count: number) {
	return {
		listInterventions: vi.fn().mockResolvedValue(
			Array.from({ length: count }, (_, index) => ({
				tripId: `trip-${index}`,
				tripTitle: `Trip ${index}`,
				startsAt: "2030-01-10T01:00:00.000Z",
				reason: "no_response",
				urgency: "critical",
				hostDecisionReason: null,
				hostSafetyPlan: null,
				weatherPausedAt: null,
			}))
		),
		listAlerts: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
	} as unknown as typeof weatherDecisionsService;
}

function penalties(pending: number) {
	return {
		listForAdmin: vi
			.fn()
			.mockImplementation(async (filter: string) =>
				filter === "waiver_pending"
					? Array.from({ length: pending }, (_, index) => ({ id: `p-${index}` }))
					: []
			),
	} as unknown as typeof weatherPenaltiesService;
}

function visit(path: string) {
	window.history.replaceState({}, "", path);
}

beforeEach(() => {
	localStorage.setItem("accessToken", "test-token");
	visit("/admin/weather");
});

afterEach(() => {
	localStorage.removeItem("accessToken");
	vi.restoreAllMocks();
});

describe("AdminWeatherManagementPage", () => {
	it("is one Admin menu entry with the decisions tab first and pending counts on both tabs", async () => {
		render(
			<AdminWeatherManagementPage decisionsService={decisions(2)} penaltiesService={penalties(3)} />
		);
		expect(screen.getByTestId("admin-layout")).toHaveAttribute("data-active", "weather-management");
		expect(screen.getByRole("heading", { name: /Quản lý thời tiết/ })).toBeVisible();
		expect(screen.getByRole("tab", { name: /Cần xử lý/ })).toHaveAttribute("aria-selected", "true");
		expect(await screen.findByTestId("weather-interventions-panel")).toBeVisible();
		expect(await screen.findByTestId("admin-weather-count-interventions")).toHaveTextContent("2");
		expect(await screen.findByTestId("admin-weather-count-penalties")).toHaveTextContent("3");
	});

	it("switches to the Host penalties tab and keeps it in the address", async () => {
		render(
			<AdminWeatherManagementPage decisionsService={decisions(0)} penaltiesService={penalties(0)} />
		);
		fireEvent.click(screen.getByRole("tab", { name: /Phạt Host/ }));
		expect(await screen.findByTestId("weather-penalties-panel")).toBeVisible();
		expect(window.location.pathname + window.location.search).toBe("/admin/weather?tab=penalties");
		expect(screen.queryByTestId("admin-weather-count-penalties")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("tab", { name: /Cần xử lý/ }));
		await waitFor(() => expect(window.location.search).toBe(""));
	});

	it("reopens the tab from the address after a reload", async () => {
		visit("/admin/weather?tab=penalties");
		render(
			<AdminWeatherManagementPage decisionsService={decisions(0)} penaltiesService={penalties(0)} />
		);
		expect(screen.getByRole("tab", { name: /Phạt Host/ })).toHaveAttribute("aria-selected", "true");
		expect(await screen.findByTestId("weather-penalties-panel")).toBeVisible();
	});

	it.each([
		["/admin/weather-interventions", "interventions" as const, "/admin/weather"],
		["/admin/weather-penalties", "penalties" as const, "/admin/weather?tab=penalties"],
	])("moves the old link %s to the matching tab", async (oldPath, initialTab, newUrl) => {
		visit(oldPath);
		render(
			<AdminWeatherManagementPage
				initialTab={initialTab}
				decisionsService={decisions(0)}
				penaltiesService={penalties(0)}
			/>
		);
		await waitFor(() => expect(window.location.pathname + window.location.search).toBe(newUrl));
		expect(adminWeatherTabUrl(initialTab)).toBe(newUrl);
	});
});
