import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPorterVerificationGateCache } from "../features/porter-verification/components/PorterVerificationGate";
import { porterVerificationService } from "../features/porter-verification/services/porter-verification.service";
import { AppRoutes } from "./AppRoutes";
import { RoutePath } from "./routes.config";

vi.mock("../features/auth/hooks/useSessionCheck", () => ({ useSessionCheck: () => false }));
vi.mock("../features/auth/hooks/useIdleLogout", () => ({ useIdleLogout: () => undefined }));
vi.mock("../features/camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: vi.fn().mockResolvedValue(null) },
}));
vi.mock("../features/role-landing/pages/RoleLandingPage", () => ({
	RoleLandingPage: () => <p>Role dashboard</p>,
}));
vi.mock("../features/trips/pages/PorterRequestsPage", () => ({
	PorterRequestsPage: () => <p>Porter requests</p>,
}));
vi.mock("../features/porter-verification/services/porter-verification.service", () => ({
	porterVerificationService: {
		getMine: vi.fn(),
		uploadDocument: vi.fn(),
		deleteDocument: vi.fn(),
		submit: vi.fn(),
	},
}));

function signIn(roles: string[]) {
	localStorage.setItem(
		"authUser",
		JSON.stringify({
			id: "porter-1",
			email: "porter@example.com",
			role: roles[0],
			roles,
			status: "active",
			createdAt: "2026-01-01T00:00:00Z",
		})
	);
}

function verification(status: "pending_documents" | "approved") {
	return {
		porterId: "porter-1",
		status,
		submittedAt: null,
		reviewedAt: null,
		rejectionReason: null,
		version: 0,
		documents: [],
	};
}

describe("Porter verification routing", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		resetPorterVerificationGateCache();
	});

	it("sends an unapproved Porter from a Porter page to the verification page", async () => {
		signIn(["porter"]);
		vi.mocked(porterVerificationService.getMine).mockResolvedValue(
			verification("pending_documents")
		);
		window.history.replaceState({}, "", RoutePath.PORTER_REQUESTS);
		render(<AppRoutes />);

		expect(await screen.findByText("Xác minh chứng chỉ Porter")).toBeInTheDocument();
		expect(window.location.pathname).toBe(RoutePath.PORTER_VERIFICATION);
		expect(screen.queryByText("Porter requests")).not.toBeInTheDocument();
	});

	it("gates the dashboard of a Porter-only account", async () => {
		signIn(["porter"]);
		vi.mocked(porterVerificationService.getMine).mockResolvedValue(
			verification("pending_documents")
		);
		window.history.replaceState({}, "", RoutePath.DASHBOARD);
		render(<AppRoutes />);

		await waitFor(() => expect(window.location.pathname).toBe(RoutePath.PORTER_VERIFICATION));
		expect(screen.queryByText("Role dashboard")).not.toBeInTheDocument();
	});

	it("lets an approved Porter open Porter pages", async () => {
		signIn(["porter"]);
		vi.mocked(porterVerificationService.getMine).mockResolvedValue(verification("approved"));
		window.history.replaceState({}, "", RoutePath.PORTER_REQUESTS);
		render(<AppRoutes />);

		expect(await screen.findByText("Porter requests")).toBeInTheDocument();
		expect(window.location.pathname).toBe(RoutePath.PORTER_REQUESTS);
	});

	it("does not gate the dashboard for a user who also has another role", async () => {
		signIn(["host", "porter"]);
		window.history.replaceState({}, "", RoutePath.DASHBOARD);
		render(<AppRoutes />);

		expect(await screen.findByText("Role dashboard")).toBeInTheDocument();
		expect(porterVerificationService.getMine).not.toHaveBeenCalled();
	});
});
