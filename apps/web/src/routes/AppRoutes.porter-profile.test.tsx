import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPorterVerificationGateCache } from "../features/porter-verification/components/PorterVerificationGate";
import type { RoleKey } from "../features/role-landing/types";
import { AppRoutes } from "./AppRoutes";
import { RoutePath } from "./routes.config";

vi.mock("../features/auth/hooks/useSessionCheck", () => ({ useSessionCheck: () => false }));
vi.mock("../features/auth/hooks/useIdleLogout", () => ({ useIdleLogout: () => undefined }));
vi.mock("../features/camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: vi.fn().mockResolvedValue(null) },
}));
vi.mock("../features/porter-verification/components/PorterVerificationGate", () => ({
	PorterVerificationGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	resetPorterVerificationGateCache: () => {},
}));
vi.mock("../features/porter-profile/pages/PorterProfilePage", () => ({
	PorterProfilePage: () => <section aria-label="Porter profile content">Porter Profile</section>,
}));
vi.mock("../features/camper-profile/pages/CamperProfilePage", () => ({
	CamperProfilePage: () => <section aria-label="Camper profile content">Camper Profile</section>,
}));
vi.mock("../features/role-landing/pages/RoleLandingPage", () => ({
	RoleLandingPage: ({
		onOpenProfile,
	}: {
		onOpenProfile?: (activeRole: RoleKey) => void;
	}) => (
		<>
			<button type="button" onClick={() => onOpenProfile?.("porter")}>
				Open Porter Profile
			</button>
			<button type="button" onClick={() => onOpenProfile?.("camper")}>
				Open Camper Profile
			</button>
		</>
	),
}));

function signIn(roles: string[]): void {
	localStorage.setItem(
		"authUser",
		JSON.stringify({
			id: "user-1",
			email: "user@example.com",
			phone: null,
			role: roles[0],
			roles,
			status: "active",
			createdAt: "2026-01-01T00:00:00.000Z",
		})
	);
}

describe("Porter Profile routing", () => {
	beforeEach(() => {
		resetPorterVerificationGateCache();
		localStorage.clear();
		window.history.replaceState({}, "", RoutePath.DASHBOARD);
	});

	it("routes the dashboard Porter action to the Porter-specific Profile URL", () => {
		signIn(["porter"]);
		render(<AppRoutes />);

		fireEvent.click(screen.getByRole("button", { name: "Open Porter Profile" }));

		expect(window.location.pathname).toBe(RoutePath.PORTER_PROFILE);
		expect(screen.getByRole("region", { name: "Porter profile content" })).toBeInTheDocument();
	});

	it("preserves Camper dashboard Profile navigation", () => {
		signIn(["camper"]);
		render(<AppRoutes />);

		fireEvent.click(screen.getByRole("button", { name: "Open Camper Profile" }));

		expect(window.location.pathname).toBe(RoutePath.CAMPER_PROFILE);
		expect(screen.getByRole("region", { name: "Camper profile content" })).toBeInTheDocument();
	});

	it("renders a direct Porter Profile URL inside the Porter layout and marks Profile active", () => {
		signIn(["porter"]);
		window.history.replaceState({}, "", RoutePath.PORTER_PROFILE);
		render(<AppRoutes />);

		expect(screen.getByRole("region", { name: "Porter profile content" })).toBeInTheDocument();
		expect(screen.getByRole("navigation", { name: "Dashboard navigation" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Hồ sơ & Năng lực" })).toHaveAttribute(
			"aria-current",
			"page"
		);
	});

	it("keeps the Porter layout for a multi-role Host and Porter account", () => {
		signIn(["host", "porter"]);
		window.history.replaceState({}, "", RoutePath.PORTER_PROFILE);
		render(<AppRoutes />);

		expect(screen.getByText("Porter Ops")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Hồ sơ & Năng lực" })).toHaveAttribute(
			"aria-current",
			"page"
		);
	});

	it("canonicalizes a legacy Camper Profile URL for a Porter-only account", async () => {
		signIn(["porter"]);
		window.history.replaceState({}, "", RoutePath.CAMPER_PROFILE);
		render(<AppRoutes />);

		await waitFor(() => expect(window.location.pathname).toBe(RoutePath.PORTER_PROFILE));
		expect(screen.getByRole("region", { name: "Porter profile content" })).toBeInTheDocument();
	});

	it("denies the Porter Profile route to users without the Porter role", () => {
		signIn(["host"]);
		window.history.replaceState({}, "", RoutePath.PORTER_PROFILE);
		render(<AppRoutes />);

		expect(screen.getByRole("heading", { name: "Truy cập bị từ chối" })).toBeInTheDocument();
		expect(
			screen.queryByRole("region", { name: "Porter profile content" })
		).not.toBeInTheDocument();
	});
});
