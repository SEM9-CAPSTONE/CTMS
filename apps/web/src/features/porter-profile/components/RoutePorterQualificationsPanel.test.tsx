import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as tokenStorage from "../../auth/utils/tokenStorage";
import { porterProfileService } from "../services/porter-profile.service";
import type { RoutePorterQualification } from "../types";
import { RoutePorterQualificationsPanel } from "./RoutePorterQualificationsPanel";

describe("RoutePorterQualificationsPanel", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const sampleRouteQualifications: RoutePorterQualification[] = [
		{
			qualificationId: "qual-1",
			porterId: "porter-1",
			porterDisplayName: "Alex Porter",
			routeId: "route-100",
			proficiency: "proficient",
			timesLed: 6,
			verifiedBy: null,
			verifiedAt: null,
			version: 1,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
		},
		{
			qualificationId: "qual-2",
			porterId: "porter-2",
			porterDisplayName: "Sam Porter",
			routeId: "route-100",
			proficiency: "expert",
			timesLed: 12,
			verifiedBy: "host-1",
			verifiedAt: "2026-02-01T10:00:00.000Z",
			version: 2,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-02-01T10:00:00.000Z",
		},
	];

	it("renders loading state", () => {
		vi.spyOn(porterProfileService, "getRoutePorterQualifications").mockReturnValue(
			new Promise(() => {}) // pending
		);

		render(<RoutePorterQualificationsPanel routeId="route-100" />);

		expect(screen.getByTestId("route-qualifications-loading")).toBeVisible();
	});

	it("renders empty state when no porters exist for the route", async () => {
		vi.spyOn(porterProfileService, "getRoutePorterQualifications").mockResolvedValue([]);

		render(<RoutePorterQualificationsPanel routeId="route-100" />);

		await waitFor(() => {
			expect(screen.getByTestId("route-qualifications-empty")).toBeVisible();
		});
		expect(screen.getByText("Chưa có Porter nào đăng ký chứng chỉ cho tuyến này")).toBeVisible();
	});

	it("renders table with minimal porter info and no sensitive personal data", async () => {
		vi.spyOn(porterProfileService, "getRoutePorterQualifications").mockResolvedValue(
			sampleRouteQualifications
		);

		render(<RoutePorterQualificationsPanel routeId="route-100" routeName="Sơn Trà" />);

		await waitFor(() => {
			expect(screen.getByTestId("route-qualifications-table")).toBeVisible();
		});

		expect(screen.getByText("Alex Porter")).toBeVisible();
		expect(screen.getByText("Sam Porter")).toBeVisible();
		expect(screen.getByText("Thành thạo (Proficient)")).toBeVisible();
		expect(screen.getByText("Chuyên gia (Expert)")).toBeVisible();

		// Check sensitive data absence
		expect(screen.queryByText(/email/i)).toBeNull();
		expect(screen.queryByText(/phone/i)).toBeNull();
		expect(screen.queryByText(/dayRate/i)).toBeNull();
		expect(screen.queryByText(/salary/i)).toBeNull();
	});

	it("allows authorized Host/Admin to click verify on unverified qualification and sends expectedVersion", async () => {
		const user = userEvent.setup();
		vi.spyOn(tokenStorage, "getStoredAuthUser").mockReturnValue({
			id: "host-1",
			email: "host@ctms.local",
			phone: null,
			status: "active",
			createdAt: "2026-01-01T00:00:00Z",
			role: "host",
		});

		vi.spyOn(porterProfileService, "getRoutePorterQualifications").mockResolvedValue(
			sampleRouteQualifications
		);
		const verifySpy = vi.spyOn(porterProfileService, "verifyRouteQualification").mockResolvedValue({
			...sampleRouteQualifications[0],
			verifiedBy: "host-1",
			verifiedAt: "2026-03-01T12:00:00.000Z",
			version: 2,
		});

		render(<RoutePorterQualificationsPanel routeId="route-100" />);

		await waitFor(() => {
			expect(screen.getByTestId("verify-btn-qual-1")).toBeVisible();
		});

		// qual-2 is already verified, so verify button should not be present
		expect(screen.queryByTestId("verify-btn-qual-2")).toBeNull();
		expect(screen.getByText("Đã chuẩn hóa")).toBeVisible();

		await user.click(screen.getByTestId("verify-btn-qual-1"));

		await waitFor(() => {
			expect(verifySpy).toHaveBeenCalledWith("qual-1", { expectedVersion: 1 });
		});
	});

	it("blocks self-verification button when current user ID matches porterId", async () => {
		vi.spyOn(tokenStorage, "getStoredAuthUser").mockReturnValue({
			id: "porter-1", // same as qual-1 porterId
			email: "porter@ctms.local",
			phone: null,
			status: "active",
			createdAt: "2026-01-01T00:00:00Z",
			role: "porter",
		});

		vi.spyOn(porterProfileService, "getRoutePorterQualifications").mockResolvedValue(
			sampleRouteQualifications
		);

		render(<RoutePorterQualificationsPanel routeId="route-100" />);

		await waitFor(() => {
			expect(screen.getByTestId("route-qualifications-table")).toBeVisible();
		});

		// Verify button must NOT be present for self
		expect(screen.queryByTestId("verify-btn-qual-1")).toBeNull();
		expect(screen.getByText("Tự xác minh (Bị chặn)")).toBeVisible();
	});
});
