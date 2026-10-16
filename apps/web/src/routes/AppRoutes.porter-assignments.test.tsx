import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../features/role-landing/components/Sidebar";
import { dashboards } from "../features/role-landing/constants";
import { AppRoutes } from "./AppRoutes";
import { RoutePath } from "./routes.config";

vi.mock("../features/auth/hooks/useSessionCheck", () => ({ useSessionCheck: () => false }));
vi.mock("../features/auth/hooks/useIdleLogout", () => ({ useIdleLogout: () => undefined }));
vi.mock("../features/camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: vi.fn().mockResolvedValue(null) },
}));
vi.mock("../features/role-landing/pages/RoleLandingPage", () => ({
	RoleLandingPage: () => <p>Porter dashboard</p>,
}));
vi.mock("../features/role-landing/components/PorterAssignedTripsPanel", () => ({
	PorterAssignedTripsPanel: ({
		onViewTripDetail,
	}: { onViewTripDetail?: (tripId: string) => void }) => (
		<section aria-label="Chuyến đi được phân công">
			<p>Assigned Trips</p>
			<button type="button" onClick={() => onViewTripDetail?.(TRIP_ID)}>
				Chi tiết
			</button>
		</section>
	),
}));
vi.mock("../features/role-landing/components/PorterAssignedTripDetail", () => ({
	PorterAssignedTripDetail: ({ tripId, onBack }: { tripId: string; onBack?: () => void }) => (
		<section aria-label="Chi tiết chuyến đi được phân công">
			<p>Detail {tripId}</p>
			<button type="button" onClick={onBack}>
				Quay lại
			</button>
		</section>
	),
}));

const TRIP_ID = "4f9c2b1e-8d3a-4c5b-9e7f-1a2b3c4d5e6f";

function signIn(roles = ["porter"]) {
	localStorage.setItem(
		"authUser",
		JSON.stringify({
			id: "porter",
			email: "porter@example.com",
			role: roles[0],
			roles,
			status: "active",
			createdAt: "2026-01-01T00:00:00Z",
		})
	);
}

describe("Porter assignment navigation", () => {
	beforeEach(() => {
		localStorage.clear();
		window.history.replaceState({}, "", RoutePath.DASHBOARD);
	});
	it("opens the real assignment route when the sidebar item is clicked", async () => {
		signIn();
		const close = vi.fn();
		render(
			<>
				<Sidebar
					config={dashboards.porter}
					grantedRoles={["porter"]}
					activeRole="porter"
					onRoleChange={() => {}}
					profile={null}
					onClose={close}
				/>
				<AppRoutes />
			</>
		);
		fireEvent.click(screen.getByRole("button", { name: "Phân công" }));
		expect(window.location.pathname).toBe(RoutePath.PORTER_ASSIGNMENTS);
		expect(
			await screen.findByRole("region", { name: "Chuyến đi được phân công" })
		).toBeInTheDocument();
		expect(close).toHaveBeenCalledOnce();
	});
	it("supports directly opening or reloading the assignment URL and marks its sidebar item active", () => {
		signIn();
		window.history.replaceState({}, "", RoutePath.PORTER_ASSIGNMENTS);
		render(<AppRoutes />);
		expect(screen.getByText("Assigned Trips")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Phân công" })).toHaveAttribute(
			"aria-current",
			"page"
		);
		expect(screen.getByRole("button", { name: "Tổng quan" })).not.toHaveAttribute("aria-current");
	});
	it("retains Porter navigation for a user who also has the Host role", () => {
		signIn(["host", "porter"]);
		window.history.replaceState({}, "", RoutePath.PORTER_ASSIGNMENTS);
		render(<AppRoutes />);
		expect(screen.getByRole("button", { name: "Phân công" })).toHaveAttribute(
			"aria-current",
			"page"
		);
		expect(screen.getByRole("button", { name: "Yêu cầu Trip" })).toBeInTheDocument();
	});
	it("opens the assigned Trip detail route and returns to the list", () => {
		signIn();
		window.history.replaceState({}, "", RoutePath.PORTER_ASSIGNMENTS);
		render(<AppRoutes />);
		fireEvent.click(screen.getByRole("button", { name: "Chi tiết" }));
		expect(window.location.pathname).toBe(`${RoutePath.PORTER_ASSIGNMENTS}/${TRIP_ID}`);
		expect(screen.getByText(`Detail ${TRIP_ID}`)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Phân công" })).toHaveAttribute(
			"aria-current",
			"page"
		);
		fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
		expect(window.location.pathname).toBe(RoutePath.PORTER_ASSIGNMENTS);
		expect(screen.getByText("Assigned Trips")).toBeInTheDocument();
	});
	it("rejects a malformed assigned Trip id and denies the detail to non-Porters", () => {
		signIn();
		window.history.replaceState({}, "", `${RoutePath.PORTER_ASSIGNMENTS}/not-a-trip`);
		const { unmount } = render(<AppRoutes />);
		expect(screen.queryByText(/^Detail /)).not.toBeInTheDocument();
		unmount();
		localStorage.clear();
		signIn(["host"]);
		window.history.replaceState({}, "", `${RoutePath.PORTER_ASSIGNMENTS}/${TRIP_ID}`);
		render(<AppRoutes />);
		expect(screen.getByRole("heading", { name: "Truy cập bị từ chối" })).toBeInTheDocument();
	});
	it("denies users without the Porter role", () => {
		signIn(["host"]);
		window.history.replaceState({}, "", RoutePath.PORTER_ASSIGNMENTS);
		render(<AppRoutes />);
		expect(screen.getByRole("heading", { name: "Truy cập bị từ chối" })).toBeInTheDocument();
		expect(screen.queryByText("Assigned Trips")).not.toBeInTheDocument();
	});
	it("requires sign-in before opening assignments", () => {
		window.history.replaceState({}, "", RoutePath.PORTER_ASSIGNMENTS);
		render(<AppRoutes />);
		expect(screen.getByRole("heading", { name: "Yêu cầu đăng nhập" })).toBeInTheDocument();
		expect(screen.queryByText("Assigned Trips")).not.toBeInTheDocument();
	});
});
