import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api/httpClient";
import { AdminPorterLevelsPage } from "../pages/AdminPorterLevelsPage";
import type { OwnQualification } from "../request-types";
import { porterLevelsService as api } from "../services/porter-levels.service";
import type { ReviewContext } from "../types";
import type { LevelPolicy } from "../types";
import { CreateLevelRequestForm } from "./CreateLevelRequestForm";
import { LevelDecisionForm } from "./LevelDecisionForm";
import { PorterLevelPanel } from "./PorterLevelPanel";

vi.mock("./AdminLevelRequestsPanel", () => ({ AdminLevelRequestsPanel: () => null }));

vi.mock("../../porter-certificates/hooks/usePorterCertificates", () => ({
	usePorterCertificates: () => ({
		certificates: [
			{
				id: "cert-1",
				type: "wfa",
				name: "Sơ cấp cứu nơi hoang dã WFA",
				status: "verified",
				expiryDate: "2028-04-20",
				rejectionReason: null,
			},
			{
				id: "cert-2",
				type: "rescue",
				name: "Kỹ thuật cứu hộ đường sông và suối thác",
				status: "rejected",
				expiryDate: "2027-06-05",
				rejectionReason: "Ảnh chụp chứng chỉ bị mờ góc dưới bên phải",
			},
		],
	}),
}));

vi.mock("../../porter-profile/hooks/usePorterProfile", () => ({
	usePorterProfile: () => ({
		profile: {
			experienceYears: 5,
		},
	}),
}));

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
		window.history.replaceState({}, "", "/admin/porter-levels");
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

	describe("CreateLevelRequestForm (Group 1 Account Criteria vs Group 2 Route Evidence)", () => {
		const mockQualifications: OwnQualification[] = [
			{
				id: "qual-1",
				porterId: "porter-1",
				porterName: "Nguyễn Minh Sơn",
				routeId: "route-1",
				routeName: "Bán Đảo Sơn Trà Discovery",
				proficiency: "expert",
				timesLed: 28,
				verifiedBy: "admin",
				version: 1,
				openRequestId: null,
			},
			{
				id: "qual-2",
				porterId: "porter-1",
				porterName: "Nguyễn Minh Sơn",
				routeId: "route-2",
				routeName: "Hải Vân Pass – Nam Hải Vân Trail",
				proficiency: "proficient",
				timesLed: 9,
				verifiedBy: "admin",
				version: 1,
				openRequestId: null,
			},
			{
				id: "qual-3",
				porterId: "porter-1",
				porterName: "Nguyễn Minh Sơn",
				routeId: "route-3",
				routeName: "Khe Ram – Suối Mơ",
				proficiency: "learning",
				timesLed: 1,
				verifiedBy: null,
				version: 1,
				openRequestId: null,
			},
		];

		const mockPolicies: LevelPolicy[] = [
			{
				level: "proficient",
				definition: {
					name: "Thành thạo",
					minExperienceYears: 2,
					minTimesLed: 10,
					requiredSkills: ["Định hướng trên tuyến", "Sơ cứu cơ bản"],
					requiredCertifications: ["wfa"],
					responsibilities: "Hỗ trợ điều phối đoàn",
				},
				version: 1,
				updatedBy: "admin",
				updatedAt: "2026-11-19T00:00:00Z",
			},
			{
				level: "expert",
				definition: {
					name: "Chuyên gia",
					minExperienceYears: 5,
					minTimesLed: 25,
					requiredSkills: ["Lập kế hoạch hành trình", "Điều phối cứu hộ", "Sơ cứu cơ bản"],
					requiredCertifications: ["wfa", "rescue"],
					responsibilities: "Phụ trách tuyến",
				},
				version: 1,
				updatedBy: "admin",
				updatedAt: "2026-11-19T00:00:00Z",
			},
		];

		beforeEach(() => {
			vi.spyOn(api, "myEvidence").mockResolvedValue({
				skills: ["Định hướng trên tuyến", "Sơ cứu cơ bản", "Chuẩn bị hành trang", "Đi theo đoàn"],
				version: 1,
			});
		});

		it("hides criteria comparison when no route is selected and shows prompt", () => {
			renderQuery(
				<CreateLevelRequestForm
					qualifications={mockQualifications}
					policies={mockPolicies}
					pending={false}
					error={null}
					onCreate={vi.fn()}
				/>
			);

			expect(screen.getByText("Chưa chọn tuyến minh chứng")).toBeInTheDocument();
			expect(screen.queryByText(/Đối chiếu tiêu chí cấp/)).not.toBeInTheDocument();
		});

		it("auto-selects next rank and separates Group 1 account-wide criteria from Group 2 route evidence", async () => {
			const user = userEvent.setup();
			renderQuery(
				<CreateLevelRequestForm
					qualifications={mockQualifications}
					policies={mockPolicies}
					pending={false}
					error={null}
					onCreate={vi.fn()}
				/>
			);

			// Click on Hải Vân Pass (currently 'proficient')
			const haiVanButton = screen.getByRole("button", {
				name: /Hải Vân Pass – Nam Hải Vân Trail/i,
			});
			await user.click(haiVanButton);

			// Target level dropdown should auto-select 'expert' (Chuyên gia)
			const targetSelect = screen.getByLabelText("Cấp muốn nâng") as HTMLSelectElement;
			expect(targetSelect.value).toBe("expert");

			// The dropdown should only contain options strictly higher than 'proficient' (i.e. only 'expert')
			const options = Array.from(targetSelect.options).map((opt) => opt.value);
			expect(options).toEqual(["expert"]);

			// Criteria comparison block is visible
			expect(screen.getByText("Đối chiếu tiêu chí cấp: Chuyên gia")).toBeInTheDocument();

			// Group 1: Tiêu chí chung tài khoản
			expect(screen.getByText("Tiêu chí chung tài khoản")).toBeInTheDocument();
			expect(
				screen.getByText("Đã xác minh một lần, dùng chung cho mọi tuyến.")
			).toBeInTheDocument();
			expect(screen.getByText("Kinh nghiệm làm người hỗ trợ")).toBeInTheDocument();

			// Certifications matched by type:
			// wfa is verified
			expect(screen.getByText("Sơ cấp cứu nơi hoang dã WFA")).toBeInTheDocument();
			expect(screen.getByText(/✅ Đã xác minh/)).toBeInTheDocument();

			// rescue is rejected with reason
			expect(screen.getByText("Kỹ thuật cứu hộ đường sông và suối thác")).toBeInTheDocument();
			expect(screen.getByText("❌ Bị từ chối")).toBeInTheDocument();
			expect(screen.getByText(/Ảnh chụp chứng chỉ bị mờ góc dưới bên phải/)).toBeInTheDocument();

			// Group 2: Minh chứng thực địa theo tuyến
			expect(screen.getByText("Minh chứng thực địa theo tuyến")).toBeInTheDocument();
			expect(
				screen.getByText(
					"Kinh nghiệm và số chuyến thực tế đã hoàn thành trên tuyến minh chứng đã chọn."
				)
			).toBeInTheDocument();
			expect(
				screen.getByText("Số chuyến đã dẫn trên tuyến Hải Vân Pass – Nam Hải Vân Trail")
			).toBeInTheDocument();
			expect(screen.getByText(/Cần hoàn thành thêm 16 chuyến/)).toBeInTheDocument();
		});

		it("auto-selects proficient when selecting learning route, where Group 1 passes with verified WFA", async () => {
			const user = userEvent.setup();
			renderQuery(
				<CreateLevelRequestForm
					qualifications={mockQualifications}
					policies={mockPolicies}
					pending={false}
					error={null}
					onCreate={vi.fn()}
				/>
			);

			// Click on Khe Ram (currently 'learning')
			const kheRamButton = screen.getByRole("button", {
				name: /Khe Ram – Suối Mơ/i,
			});
			await user.click(kheRamButton);

			// Target level dropdown should auto-select 'proficient' (Thành thạo)
			const targetSelect = screen.getByLabelText("Cấp muốn nâng") as HTMLSelectElement;
			expect(targetSelect.value).toBe("proficient");

			// Criteria comparison for Thành thạo: only requires WFA
			expect(screen.getByText("Đối chiếu tiêu chí cấp: Thành thạo")).toBeInTheDocument();
			// Group 1 is fully satisfied -> shows collapsed summary card, click expand to view detail
			expect(
				screen.getByText(/Tiêu chí chung tài khoản · Đã đạt đủ điều kiện/)
			).toBeInTheDocument();
			const expandButton = screen.getByRole("button", { name: /Xem chi tiết/i });
			await user.click(expandButton);
			// WFA is verified, so cert criteria are met
			expect(screen.getByText("Sơ cấp cứu nơi hoang dã WFA")).toBeInTheDocument();
			expect(screen.getByText(/✅ Đã xác minh/)).toBeInTheDocument();
			// Does not ask for rescue cert
			expect(screen.queryByText("Kỹ thuật cứu hộ đường sông và suối thác")).not.toBeInTheDocument();
		});

		it("handles consecutive route switches (Khe Ram -> Hải Vân Pass) updating targetLevel, options, and route timesLed dynamically", async () => {
			const user = userEvent.setup();
			renderQuery(
				<CreateLevelRequestForm
					qualifications={mockQualifications}
					policies={mockPolicies}
					pending={false}
					error={null}
					onCreate={vi.fn()}
				/>
			);

			// Step 1: Select Khe Ram (learning)
			const kheRamBtn = screen.getByRole("button", { name: /Khe Ram – Suối Mơ/i });
			await user.click(kheRamBtn);

			let targetSelect = screen.getByLabelText("Cấp muốn nâng") as HTMLSelectElement;
			expect(targetSelect.value).toBe("proficient");
			expect(Array.from(targetSelect.options).map((o) => o.value)).toEqual([
				"proficient",
				"expert",
			]);
			expect(screen.getByText("Số chuyến đã dẫn trên tuyến Khe Ram – Suối Mơ")).toBeInTheDocument();
			expect(screen.getByText(/Cần hoàn thành thêm 9 chuyến/)).toBeInTheDocument();

			// Group 1 is completely satisfied for Proficient -> Collapsed summary card
			expect(
				screen.getByText(/Tiêu chí chung tài khoản · Đã đạt đủ điều kiện/)
			).toBeInTheDocument();

			// Step 2: Switch to Hải Vân Pass (proficient)
			const haiVanBtn = screen.getByRole("button", {
				name: /Hải Vân Pass – Nam Hải Vân Trail/i,
			});
			await user.click(haiVanBtn);

			targetSelect = screen.getByLabelText("Cấp muốn nâng") as HTMLSelectElement;
			expect(targetSelect.value).toBe("expert");
			expect(Array.from(targetSelect.options).map((o) => o.value)).toEqual(["expert"]);
			expect(
				screen.getByText("Số chuyến đã dẫn trên tuyến Hải Vân Pass – Nam Hải Vân Trail")
			).toBeInTheDocument();
			expect(screen.getByText(/Cần hoàn thành thêm 16 chuyến/)).toBeInTheDocument();

			// Group 1 requires rescue cert which is rejected -> Automatically expanded to show rejection reason
			expect(screen.getByText("Cứu hộ dã ngoại / sông suối (Rescue)")).toBeInTheDocument();
			expect(screen.getByText("Kỹ thuật cứu hộ đường sông và suối thác")).toBeInTheDocument();
			expect(screen.getByText("❌ Bị từ chối")).toBeInTheDocument();
			expect(screen.getByText(/Ảnh chụp chứng chỉ bị mờ góc dưới bên phải/)).toBeInTheDocument();
		});

		it("resets Group 1 collapsed state when switching routes and provides accessible locked submit button with scroll link", async () => {
			const user = userEvent.setup();
			renderQuery(
				<CreateLevelRequestForm
					qualifications={mockQualifications}
					policies={mockPolicies}
					pending={false}
					error={null}
					onCreate={vi.fn()}
				/>
			);

			// Step 1: Select Khe Ram (Group 1 satisfied -> collapsed)
			const kheRamBtn = screen.getByRole("button", { name: /Khe Ram – Suối Mơ/i });
			await user.click(kheRamBtn);

			expect(
				screen.getByText(/Tiêu chí chung tài khoản · Đã đạt đủ điều kiện/)
			).toBeInTheDocument();
			const expandBtn = screen.getByRole("button", { name: /Xem chi tiết/i });
			expect(expandBtn).toBeInTheDocument();

			// Step 2: User manually expands Group 1 on Khe Ram
			await user.click(expandBtn);
			expect(screen.getByRole("button", { name: /Thu gọn/i })).toBeInTheDocument();
			expect(screen.getByText("Sơ cấp cứu nơi hoang dã (WFA)")).toBeInTheDocument();

			// Step 3: Switch route to Hải Vân Pass (Group 1 NOT satisfied due to rejected rescue cert)
			const haiVanBtn = screen.getByRole("button", {
				name: /Hải Vân Pass – Nam Hải Vân Trail/i,
			});
			await user.click(haiVanBtn);

			// Automatically expanded because criteria are not met, showing required label & rejection reason
			expect(screen.getByText("Cứu hộ dã ngoại / sông suối (Rescue)")).toBeInTheDocument();
			expect(screen.getByText("Kỹ thuật cứu hộ đường sông và suối thác")).toBeInTheDocument();
			expect(screen.getByText("❌ Bị từ chối")).toBeInTheDocument();

			// Step 4: Switch route BACK to Khe Ram -> Group 1 collapse must reset to collapsed!
			await user.click(kheRamBtn);
			expect(
				screen.getByText(/Tiêu chí chung tài khoản · Đã đạt đủ điều kiện/)
			).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /Xem chi tiết/i })).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: /Thu gọn/i })).not.toBeInTheDocument();

			// Step 5: Verify locked submit button and scroll link
			const submitBtn = screen.getByRole("button", { name: /Gửi yêu cầu nâng cấp/i });
			expect(submitBtn).toBeDisabled();
			expect(submitBtn).toHaveAttribute("aria-disabled", "true");

			const scrollLink = screen.getByRole("button", { name: /Cuộn tới tiêu chí chưa đạt/i });
			expect(scrollLink).toBeInTheDocument();
		});
	});
});
