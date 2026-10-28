import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestDetail, RequestStatus } from "../request-types";
import { levelRequestsService as api } from "../services/level-requests.service";
import { porterLevelsService } from "../services/porter-levels.service";
import { AdminLevelRequestsPanel } from "./AdminLevelRequestsPanel";
import { LevelDecisionForm } from "./LevelDecisionForm";
import { PorterLevelRequestsPanel } from "./PorterLevelRequestsPanel";

function detail(status: RequestStatus = "pending"): RequestDetail {
	return {
		request: {
			id: "request-1",
			qualificationId: "claim-1",
			porterId: "porter-1",
			routeId: "route-1",
			routeName: "Sơn Trà",
			porterName: "Porter A",
			currentLevel: "learning",
			currentVerified: false,
			targetLevel: "expert",
			reason: "Kinh nghiệm thực địa",
			status,
			version: 3,
			decisionReason: status === "needs_info" ? "Bổ sung chứng chỉ" : null,
			decidedBy: null,
			decidedAt: null,
			createdAt: "2026-10-28T00:00:00Z",
		},
		qualification: {
			id: "claim-1",
			porterId: "porter-1",
			routeId: "route-1",
			routeName: "Sơn Trà",
			porterName: "Porter A",
			proficiency: "learning",
			timesLed: 3,
			verifiedBy: null,
			version: 2,
		},
		dossier: {
			porterId: "porter-1",
			porterName: "Porter A",
			profileVersion: 1,
			experienceYears: 2,
			certifications: [],
			skills: [],
			evidenceVersion: 0,
			verificationStatus: "approved",
			verificationUpdatedAt: null,
			timesLed: 3,
		},
		dossierHash: "a".repeat(64),
		policy: {
			level: "expert",
			definition: {
				name: "Chuyên gia",
				minExperienceYears: null,
				minTimesLed: null,
				requiredSkills: [],
				requiredCertifications: [],
				responsibilities: "Dẫn tuyến theo phân công",
			},
			version: 4,
			updatedBy: "admin",
			updatedAt: "2026-10-28T00:00:00Z",
		},
		comparison: null,
		evidence: [],
		events: [
			{
				id: "event-1",
				actorId: "porter-1",
				action: "created",
				fromStatus: null,
				toStatus: "pending",
				reason: "Kinh nghiệm thực địa",
				createdAt: "2026-10-28T00:00:00Z",
			},
		],
	};
}
function renderQuery(children: ReactNode) {
	return render(
		<QueryClientProvider
			client={
				new QueryClient({
					defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
				})
			}
		>
			{children}
		</QueryClientProvider>
	);
}
describe("Porter upgrade request UI", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		window.history.replaceState({}, "", "/admin/porter-levels");
		vi.spyOn(api, "list").mockResolvedValue({ items: [detail().request], total: 1 });
		vi.spyOn(api, "detail").mockResolvedValue(detail());
		vi.spyOn(api, "qualifications").mockResolvedValue([
			{ ...detail().qualification, openRequestId: null },
		]);
		vi.spyOn(api, "notifications").mockResolvedValue([]);
		vi.spyOn(porterLevelsService, "myPolicies").mockResolvedValue([]);
		vi.spyOn(porterLevelsService, "myEvidence").mockResolvedValue({ skills: [], version: 0 });
		vi.spyOn(porterLevelsService, "myHistory").mockResolvedValue([]);
	});
	it("Porter chooses a higher target and submits reason plus an optional evidence file", async () => {
		const user = userEvent.setup();
		const create = vi.spyOn(api, "create").mockResolvedValue({});
		renderQuery(<PorterLevelRequestsPanel />);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Yêu cầu nâng cấp" })).toBeEnabled()
		);
		await user.click(screen.getByRole("button", { name: "Yêu cầu nâng cấp" }));
		await user.selectOptions(await screen.findByLabelText("Tuyến đã khai báo"), "claim-1");
		const target = screen.getByLabelText("Cấp muốn nâng");
		expect(within(target).queryByRole("option", { name: "learning" })).not.toBeInTheDocument();
		await user.selectOptions(target, "expert");
		await user.type(screen.getByLabelText("Lý do yêu cầu"), "Đề nghị đánh giá nâng cấp");
		const file = new File(["%PDF-1.4"], "certificate.pdf", { type: "application/pdf" });
		await user.upload(screen.getByLabelText(/Minh chứng \(tùy chọn/), file);
		await user.click(screen.getByRole("button", { name: "Gửi yêu cầu nâng cấp" }));
		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				routeId: "route-1",
				targetLevel: "expert",
				reason: "Đề nghị đánh giá nâng cấp",
				expectedQualificationVersion: 2,
				files: [file],
			})
		);
	});
	it("Porter cannot choose a Route with an open request", async () => {
		vi.mocked(api.qualifications).mockResolvedValue([
			{ ...detail().qualification, openRequestId: "request-1" },
		]);
		renderQuery(<PorterLevelRequestsPanel />);
		await screen.findByText(/Chỉ có thể yêu cầu nâng cấp/);
		expect(screen.getByRole("button", { name: "Yêu cầu nâng cấp" })).toBeDisabled();
	});
	it("needs-info permits updating the reason and resubmitting with the current request version", async () => {
		const user = userEvent.setup();
		vi.mocked(api.detail).mockResolvedValue(detail("needs_info"));
		const resubmit = vi.spyOn(api, "resubmit").mockResolvedValue({});
		renderQuery(<PorterLevelRequestsPanel />);
		await user.click(await screen.findByRole("button", { name: "Xem yêu cầu" }));
		const reason = await screen.findByLabelText("Lý do yêu cầu sau bổ sung");
		await user.clear(reason);
		await user.type(reason, "Đã bổ sung thông tin thực địa");
		await user.click(screen.getByRole("button", { name: "Gửi lại để Admin duyệt" }));
		await waitFor(() =>
			expect(resubmit).toHaveBeenCalledWith("request-1", 3, "Đã bổ sung thông tin thực địa")
		);
	});
	it("pending allows cancellation and hides evidence editing", async () => {
		const user = userEvent.setup();
		const cancel = vi.spyOn(api, "cancel").mockResolvedValue({});
		renderQuery(<PorterLevelRequestsPanel />);
		await user.click(await screen.findByRole("button", { name: "Xem yêu cầu" }));
		await user.click(await screen.findByRole("button", { name: "Hủy yêu cầu" }));
		await waitFor(() => expect(cancel).toHaveBeenCalledWith("request-1", 3));
		expect(screen.queryByLabelText("Lý do yêu cầu sau bổ sung")).not.toBeInTheDocument();
	});
	it("Admin sees side-by-side facts without grading and approves the exact requested target", async () => {
		const user = userEvent.setup();
		const review = vi.spyOn(api, "review").mockResolvedValue({});
		renderQuery(<AdminLevelRequestsPanel />);
		await user.click(await screen.findByRole("button", { name: "Xem yêu cầu" }));
		await user.type(await screen.findByLabelText("Lý do quyết định"), "Đã kiểm tra minh chứng gốc");
		expect(screen.queryByText("Đạt", { exact: true })).not.toBeInTheDocument();
		expect(screen.queryByText("Chưa đạt", { exact: true })).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Xác nhận xử lý yêu cầu" }));
		await waitFor(() =>
			expect(review).toHaveBeenCalledWith("request-1", {
				action: "approve",
				reason: "Đã kiểm tra minh chứng gốc",
				expectedVersion: 3,
				expectedQualificationVersion: 2,
				expectedPolicyVersion: 4,
				expectedDossierHash: "a".repeat(64),
			})
		);
	});
	it("Admin needs-info request can only be rejected until Porter resubmits", async () => {
		const user = userEvent.setup();
		vi.mocked(api.detail).mockResolvedValue(detail("needs_info"));
		const review = vi.spyOn(api, "review").mockResolvedValue({});
		renderQuery(<AdminLevelRequestsPanel />);
		await user.click(await screen.findByRole("button", { name: "Xem yêu cầu" }));
		const action = await screen.findByLabelText("Thao tác Admin");
		expect(within(action).getAllByRole("option")).toHaveLength(1);
		await user.click(screen.getByRole("button", { name: "Xác nhận xử lý yêu cầu" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng nhập lý do");
		expect(review).not.toHaveBeenCalled();
	});
	it("direct level review is blocked with a link to the open request", () => {
		render(
			<LevelDecisionForm
				context={{ ...detail(), openRequestId: "request-1" }}
				pending={false}
				error={null}
				onDecide={vi.fn()}
			/>
		);
		expect(screen.getByRole("link", { name: "Mở yêu cầu để xử lý" })).toHaveAttribute(
			"href",
			"?request=request-1"
		);
		expect(screen.getByRole("button", { name: "Lưu quyết định" })).toBeDisabled();
	});
});
