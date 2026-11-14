import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api/httpClient";
import { AdminPorterLevelsPage } from "../pages/AdminPorterLevelsPage";
import { porterLevelsService as api } from "../services/porter-levels.service";
import type { ReviewContext } from "../types";
import { LevelDecisionForm } from "./LevelDecisionForm";
import { PorterLevelPanel } from "./PorterLevelPanel";

vi.mock("./AdminLevelRequestsPanel", () => ({ AdminLevelRequestsPanel: () => null }));

vi.mock("../../admin-layout/components/AdminLayout", () => ({
	AdminLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
const context: ReviewContext = {
	qualification: {
		id: "qualification",
		porterId: "porter",
		routeId: "route",
		routeName: "Sơn Trà",
		porterName: "người hỗ trợ A",
		proficiency: "learning",
		timesLed: 2,
		verifiedBy: null,
		version: 3,
	},
	dossier: {
		porterId: "porter",
		porterName: "người hỗ trợ A",
		profileVersion: 1,
		experienceYears: 2,
		certifications: [],
		skills: [],
		evidenceVersion: 0,
		verificationStatus: "approved",
		verificationUpdatedAt: null,
		timesLed: 2,
	},
	dossierHash: "a".repeat(64),
	policy: {
		level: "expert",
		definition: {
			name: "Chuyên gia",
			minExperienceYears: 5,
			minTimesLed: null,
			requiredSkills: ["Sơ cứu"],
			requiredCertifications: [],
			responsibilities: "Dẫn tuyến được duyệt",
		},
		version: 2,
		updatedBy: "admin",
		updatedAt: "2026-10-28T00:00:00Z",
	},
	comparison: {
		experience: false,
		timesLed: null,
		missingSkills: ["Sơ cứu"],
		missingCertifications: [],
	},
};
function renderQuery(children: ReactNode) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
describe("người hỗ trợ level UI", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(api, "policies").mockResolvedValue([]);
		vi.spyOn(api, "qualifications").mockResolvedValue({ items: [context.qualification], total: 1 });
		vi.spyOn(api, "comparison").mockResolvedValue(context);
		vi.spyOn(api, "history").mockResolvedValue([]);
	});
	it("starts with blank Admin criteria and sends explicit nulls without inventing thresholds", async () => {
		const user = userEvent.setup();
		if (!context.policy) throw new Error("Expected configured test policy");
		const save = vi
			.spyOn(api, "savePolicy")
			.mockResolvedValue({ ...context.policy, level: "learning" });
		renderQuery(<AdminPorterLevelsPage />);
		await user.click(screen.getByRole("link", { name: "Tiêu chí cấp độ" }));
		expect(await screen.findByLabelText("Tên cấp")).toHaveValue("");
		expect(screen.getByLabelText("Số năm kinh nghiệm tối thiểu")).toHaveValue(null);
		await user.type(screen.getByLabelText("Tên cấp"), "Học việc");
		await user.type(screen.getByLabelText("Phạm vi phụ trách"), "Hỗ trợ trưởng nhóm trên tuyến");
		await user.click(screen.getByRole("button", { name: "Lưu tiêu chí" }));
		await waitFor(() =>
			expect(save).toHaveBeenCalledWith("learning", {
				name: "Học việc",
				responsibilities: "Hỗ trợ trưởng nhóm trên tuyến",
				minExperienceYears: null,
				minTimesLed: null,
				requiredSkills: [],
				requiredCertifications: [],
				expectedVersion: 0,
			})
		);
	});
	it("opens the selected Route qualification and shows its comparison and history", async () => {
		const user = userEvent.setup();
		renderQuery(<AdminPorterLevelsPage />);
		await user.click(screen.getByRole("link", { name: "Xét cấp trực tiếp" }));
		await user.click(await screen.findByRole("button", { name: "Xét cấp" }));
		expect(await screen.findByRole("dialog")).toBeVisible();
		expect(await screen.findByText(/Đối chiếu với Chuyên gia/)).toBeVisible();
		expect(screen.queryByText("Chưa đạt")).not.toBeInTheDocument();
		expect(screen.getByText("Chưa có quyết định xét cấp.")).toBeVisible();
		expect(api.comparison).toHaveBeenCalledWith("qualification", "learning");
	});
	it("keeps the reason on a stale-data failure and submits the exact reviewed versions", async () => {
		const user = userEvent.setup();
		const decide = vi.fn().mockRejectedValue(new HttpError("stale", 409, {}));
		const view = render(
			<LevelDecisionForm context={context} pending={false} error={null} onDecide={decide} />
		);
		await user.type(screen.getByLabelText("Ghi chú xét cấp"), "Đã kiểm tra hồ sơ gốc");
		await user.click(screen.getByRole("button", { name: "Công nhận cấp" }));
		expect(decide).not.toHaveBeenCalled();
		await user.click(screen.getByRole("button", { name: "Xác nhận công nhận cấp" }));
		await waitFor(() =>
			expect(decide).toHaveBeenCalledWith({
				level: "expert",
				outcome: "approved",
				reason: "Đã kiểm tra hồ sơ gốc",
				expectedQualificationVersion: 3,
				expectedPolicyVersion: 2,
				expectedDossierHash: context.dossierHash,
			})
		);
		view.rerender(
			<LevelDecisionForm
				context={context}
				pending={false}
				error={new HttpError("stale", 409, {})}
				onDecide={decide}
			/>
		);
		expect(screen.getByLabelText("Ghi chú xét cấp")).toHaveValue("Đã kiểm tra hồ sơ gốc");
		expect(screen.getByRole("alert")).toHaveTextContent("đã thay đổi");
	});
	it("requires certificate approval for direct recognition", async () => {
		const decide = vi.fn();
		render(
			<LevelDecisionForm
				context={{
					...context,
					dossier: { ...context.dossier, verificationStatus: "pending_review" },
				}}
				pending={false}
				error={null}
				onDecide={decide}
			/>
		);
		expect(screen.getByRole("button", { name: "Công nhận cấp" })).toBeDisabled();
		expect(screen.queryByLabelText("Quyết định")).not.toBeInTheDocument();
		expect(decide).not.toHaveBeenCalled();
	});
	it("does not submit a direct change when its explicit confirmation is cancelled", async () => {
		const user = userEvent.setup();
		const decide = vi.fn();
		render(<LevelDecisionForm context={context} pending={false} error={null} onDecide={decide} />);
		await user.type(screen.getByLabelText("Ghi chú xét cấp"), "Đối chiếu hồ sơ với cấp đề xuất");
		await user.click(screen.getByRole("button", { name: "Công nhận cấp" }));
		expect(screen.getByText(/người hỗ trợ A: Học việc → Chuyên gia/)).toBeVisible();
		await user.click(screen.getByTestId("confirm-modal-cancel"));
		expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
		expect(decide).not.toHaveBeenCalled();
	});
	it("defaults direct review to the selected người hỗ trợ's current level instead of learning", async () => {
		const user = userEvent.setup();
		vi.mocked(api.qualifications).mockResolvedValue({
			items: [{ ...context.qualification, proficiency: "expert", verifiedBy: "admin" }],
			total: 1,
		});
		vi.mocked(api.comparison).mockResolvedValue({
			...context,
			qualification: { ...context.qualification, proficiency: "expert", verifiedBy: "admin" },
		});
		renderQuery(<AdminPorterLevelsPage />);
		await user.click(screen.getByRole("link", { name: "Xét cấp trực tiếp" }));
		await user.click(await screen.findByRole("button", { name: "Xét cấp" }));
		await waitFor(() => expect(api.comparison).toHaveBeenCalledWith("qualification", "expert"));
		expect(await screen.findByRole("button", { name: "Đã công nhận cấp này" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Đã công nhận cấp này" })).toBeDisabled();
	});
	it("records non-recognition with a reason while retaining the selected qualification identity", async () => {
		const user = userEvent.setup();
		const decide = vi.fn().mockResolvedValue({});
		render(
			<LevelDecisionForm
				context={{
					...context,
					qualification: { ...context.qualification, proficiency: "expert", verifiedBy: "admin" },
					dossier: { ...context.dossier, verificationStatus: "pending_review" },
				}}
				pending={false}
				error={null}
				onDecide={decide}
			/>
		);
		await user.click(screen.getByRole("radio", { name: "Không công nhận" }));
		await user.type(
			screen.getByLabelText("Ghi chú xét cấp"),
			"Chưa đủ kinh nghiệm để phụ trách tuyến này"
		);
		await user.click(screen.getByRole("button", { name: "Lưu quyết định" }));
		expect(decide).not.toHaveBeenCalled();
		await user.click(screen.getByRole("button", { name: "Xác nhận không công nhận" }));
		await waitFor(() =>
			expect(decide).toHaveBeenCalledWith(
				expect.objectContaining({
					outcome: "rejected",
					level: "expert",
					expectedQualificationVersion: 3,
					expectedDossierHash: context.dossierHash,
				})
			)
		);
	});

	it("searches qualifications across pages using the submitted term", async () => {
		const user = userEvent.setup();
		renderQuery(<AdminPorterLevelsPage />);
		await user.click(screen.getByRole("link", { name: "Xét cấp trực tiếp" }));
		await user.type(
			screen.getByRole("textbox", { name: "Tìm người hỗ trợ hoặc tuyến" }),
			"Sơn Trà"
		);
		await user.click(screen.getByRole("button", { name: "Tìm kiếm" }));
		await waitFor(() => expect(api.qualifications).toHaveBeenCalledWith(1, "Sơn Trà"));
		await user.click(screen.getByRole("button", { name: "Đặt lại" }));
		await waitFor(() => expect(api.qualifications).toHaveBeenCalledWith(1, ""));
	});

	it("lets người hỗ trợ save declared skills with optimistic concurrency and no rank field", async () => {
		const user = userEvent.setup();
		vi.spyOn(api, "myPolicies").mockResolvedValue([]);
		vi.spyOn(api, "myEvidence").mockResolvedValue({ skills: [], version: 4 });
		vi.spyOn(api, "myHistory").mockResolvedValue([]);
		const save = vi
			.spyOn(api, "saveEvidence")
			.mockResolvedValue({ skills: ["Sơ cứu", "Định hướng"], version: 5 });
		renderQuery(<PorterLevelPanel />);
		await user.type(
			await screen.findByLabelText("Kỹ năng tự khai (mỗi dòng một mục)"),
			"Sơ cứu\nĐịnh hướng"
		);
		await user.click(screen.getByRole("button", { name: "Lưu kỹ năng" }));
		await waitFor(() =>
			expect(save).toHaveBeenCalledWith({ skills: ["Sơ cứu", "Định hướng"], expectedVersion: 4 })
		);
	});
});
