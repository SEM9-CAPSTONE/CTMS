import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PorterRouteQualification } from "../types";
import { PorterQualificationsPanel } from "./PorterQualificationsPanel";

describe("PorterQualificationsPanel", () => {
	const mockRoutes = [
		{ id: "route-1", name: "Sơn Trà - Tuyến 01" },
		{ id: "route-2", name: "Bidoup - Núi Bà" },
	];

	const sampleQualifications: PorterRouteQualification[] = [
		{
			qualificationId: "qual-1",
			porterId: "porter-1",
			routeId: "route-1",
			proficiency: "proficient",
			timesLed: 4,
			verifiedBy: "host-1",
			verifiedAt: "2026-02-15T09:00:00.000Z",
			version: 2,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-02-15T09:00:00.000Z",
		},
		{
			qualificationId: "qual-2",
			porterId: "porter-1",
			routeId: "route-2",
			proficiency: "learning",
			timesLed: 0,
			verifiedBy: null,
			verifiedAt: null,
			version: 1,
			createdAt: "2026-03-01T00:00:00.000Z",
			updatedAt: "2026-03-01T00:00:00.000Z",
		},
	];

	it("renders loading state cleanly", () => {
		render(
			<PorterQualificationsPanel
				qualifications={[]}
				isLoading={true}
				isSubmitting={false}
				errorMessage={null}
				successMessage={null}
				conflictMessage={null}
				availableRoutes={mockRoutes}
				onUpsert={vi.fn()}
				onReload={vi.fn()}
			/>
		);

		expect(screen.getByTestId("qualifications-loading")).toBeVisible();
	});

	it("renders empty state with CTA when qualifications list is empty", () => {
		render(
			<PorterQualificationsPanel
				qualifications={[]}
				isLoading={false}
				isSubmitting={false}
				errorMessage={null}
				successMessage={null}
				conflictMessage={null}
				availableRoutes={mockRoutes}
				onUpsert={vi.fn()}
				onReload={vi.fn()}
			/>
		);

		expect(screen.getByTestId("qualifications-empty-state")).toBeVisible();
		expect(screen.getByText("Chưa có chứng chỉ tuyến trekking nào")).toBeVisible();
	});

	it("renders existing qualifications with verified and unverified statuses", () => {
		render(
			<PorterQualificationsPanel
				qualifications={sampleQualifications}
				isLoading={false}
				isSubmitting={false}
				errorMessage={null}
				successMessage={null}
				conflictMessage={null}
				availableRoutes={mockRoutes}
				onUpsert={vi.fn()}
				onReload={vi.fn()}
			/>
		);

		expect(screen.getByText("Sơn Trà - Tuyến 01")).toBeVisible();
		expect(screen.getByText("Bidoup - Núi Bà")).toBeVisible();

		// Check verified vs unverified badges
		expect(screen.getByTestId("qualification-verified-badge")).toHaveTextContent("Đã xác minh");
		expect(screen.getByTestId("qualification-unverified-badge")).toHaveTextContent("Chưa xác minh");

		// Check lead eligibility
		expect(screen.getByText("Đủ điều kiện làm Trưởng nhóm")).toBeVisible();
		expect(screen.getByText("Học việc (Không đủ điều kiện Lead)")).toBeVisible();
	});

	it("opens dialog to create new qualification and submits without expectedVersion", async () => {
		const user = userEvent.setup();
		const onUpsert = vi.fn().mockResolvedValue({
			qualificationId: "qual-new",
			version: 1,
		});

		render(
			<PorterQualificationsPanel
				qualifications={[]}
				isLoading={false}
				isSubmitting={false}
				errorMessage={null}
				successMessage={null}
				conflictMessage={null}
				availableRoutes={mockRoutes}
				onUpsert={onUpsert}
				onReload={vi.fn()}
			/>
		);

		await user.click(screen.getByTestId("add-qualification-button"));

		expect(screen.getByTestId("qualification-dialog")).toBeVisible();
		expect(screen.getByRole("heading", { name: "Thêm chứng chỉ tuyến trekking" })).toBeVisible();

		// Select proficiency "proficient"
		await user.click(screen.getByText("Thành thạo (Proficient)"));

		// Times led input
		const timesLedInput = screen.getByLabelText(/Số lần đã dẫn/i);
		await user.clear(timesLedInput);
		await user.type(timesLedInput, "3");

		await user.click(screen.getByTestId("submit-qualification-button"));

		await waitFor(() => {
			expect(onUpsert).toHaveBeenCalledWith("route-1", {
				proficiency: "proficient",
				timesLed: 3,
				expectedVersion: undefined,
			});
		});
	});

	it("shows verified edit warning when opening edit dialog for a verified qualification", async () => {
		const user = userEvent.setup();
		const onUpsert = vi.fn().mockResolvedValue(null);

		render(
			<PorterQualificationsPanel
				qualifications={sampleQualifications}
				isLoading={false}
				isSubmitting={false}
				errorMessage={null}
				successMessage={null}
				conflictMessage={null}
				availableRoutes={mockRoutes}
				onUpsert={onUpsert}
				onReload={vi.fn()}
			/>
		);

		await user.click(screen.getByTestId("edit-qualification-qual-1"));

		expect(screen.getByTestId("qualification-dialog")).toBeVisible();
		expect(screen.getByTestId("verified-edit-warning")).toBeVisible();
		expect(
			screen.getByText(/Thay đổi mức độ thành thạo hoặc số lần dẫn đoàn sẽ hủy xác minh hiện tại/i)
		).toBeVisible();

		// Submit with expectedVersion
		await user.click(screen.getByTestId("submit-qualification-button"));

		await waitFor(() => {
			expect(onUpsert).toHaveBeenCalledWith("route-1", {
				proficiency: "proficient",
				timesLed: 4,
				expectedVersion: 2,
			});
		});
	});
});
