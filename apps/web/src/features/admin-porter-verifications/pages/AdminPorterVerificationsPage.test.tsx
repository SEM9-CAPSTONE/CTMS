import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminPorterVerificationsService } from "../services/admin-porter-verifications.service";
import type { AdminPorterVerificationDetail, AdminPorterVerificationSummary } from "../types";
import { AdminPorterVerificationsPage } from "./AdminPorterVerificationsPage";

vi.mock("../services/admin-porter-verifications.service", () => ({
	adminPorterVerificationsService: {
		list: vi.fn(),
		getDetail: vi.fn(),
		approve: vi.fn(),
		reject: vi.fn(),
	},
}));

const summary: AdminPorterVerificationSummary = {
	porterId: "porter-1",
	fullName: "Lý A Porter",
	email: "porter@example.com",
	phone: "+84912345678",
	status: "pending_review",
	submittedAt: "2026-10-17T10:00:00.000Z",
	reviewedAt: null,
	documentCount: 2,
};

const detail: AdminPorterVerificationDetail = {
	porterId: "porter-1",
	status: "pending_review",
	submittedAt: "2026-10-17T10:00:00.000Z",
	reviewedAt: null,
	rejectionReason: null,
	version: 2,
	guideCard: { cardType: "noi_dia", cardNumber: "123456789", expiresOn: "2099-01-01" },
	cardCheck: {
		labels: ["NAME_MISMATCH"],
		reading: {
			fullName: "Trần Văn Khác",
			cardNumber: "123456789",
			cardType: "noi_dia",
			expiresOn: "2099-01-01",
			confidence: 0.9,
			documentId: null,
		},
		autoRejected: false,
	},
	cardCheckedAt: "2026-10-17T10:00:00.000Z",
	registryCheckedBy: null,
	registryCheckedAt: null,
	fullName: "Lý A Porter",
	email: "porter@example.com",
	phone: "+84912345678",
	reviewedBy: null,
	experienceYears: 4,
	certifications: ["Sơ cấp cứu"],
	documents: [
		{
			id: "doc-1",
			fileUrl: "https://files.test/cert.pdf",
			originalName: "cert.pdf",
			mimeType: "application/pdf",
			sizeBytes: 4096,
			uploadedAt: "2026-10-17T09:00:00.000Z",
		},
		{
			id: "doc-2",
			fileUrl: "https://files.test/card.png",
			originalName: "card.png",
			mimeType: "image/png",
			sizeBytes: 2048,
			uploadedAt: "2026-10-17T09:05:00.000Z",
		},
	],
};

describe("AdminPorterVerificationsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(adminPorterVerificationsService.list).mockResolvedValue({
			items: [summary],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
		});
		vi.mocked(adminPorterVerificationsService.getDetail).mockResolvedValue(detail);
	});

	it("lists pending reviews by default and shows the documents", async () => {
		const user = userEvent.setup();
		render(<AdminPorterVerificationsPage />);

		const row = await screen.findByTestId("porter-verification-row-porter-1");
		expect(adminPorterVerificationsService.list).toHaveBeenCalledWith({
			status: "pending_review",
			page: 1,
			limit: 20,
		});
		expect(within(row).getByText("Chờ duyệt")).toBeInTheDocument();

		await user.click(within(row).getByRole("button", { name: /Xem & duyệt/ }));
		const dialog = await screen.findByRole("dialog", { name: "Hồ sơ xác minh Porter" });
		expect(within(dialog).getByText("cert.pdf")).toBeInTheDocument();
		expect(within(dialog).getByAltText("card.png")).toHaveAttribute(
			"src",
			"https://files.test/card.png"
		);
		expect(within(dialog).getByText("Sơ cấp cứu")).toBeInTheDocument();
	});

	it("approves after confirmation and refreshes the list", async () => {
		const user = userEvent.setup();
		vi.mocked(adminPorterVerificationsService.approve).mockResolvedValue({
			...detail,
			status: "approved",
			reviewedAt: "2026-10-17T12:00:00.000Z",
		});
		render(<AdminPorterVerificationsPage />);

		await user.click(await screen.findByRole("button", { name: /Xem & duyệt/ }));
		// The Admin must confirm the official registry check before approving.
		const approveButton = await screen.findByRole("button", { name: "Duyệt hồ sơ" });
		expect(approveButton).toBeDisabled();
		await user.click(screen.getByRole("checkbox", { name: /huongdanvien\.vn/ }));
		await user.click(approveButton);
		await user.click(screen.getByRole("button", { name: "Duyệt" }));

		expect(await screen.findByText("Đã duyệt hồ sơ của Lý A Porter.")).toBeInTheDocument();
		expect(adminPorterVerificationsService.approve).toHaveBeenCalledWith("porter-1");
		expect(adminPorterVerificationsService.list).toHaveBeenCalledTimes(2);
		expect(screen.queryByRole("button", { name: "Duyệt hồ sơ" })).not.toBeInTheDocument();
	});

	it("shows the declared card next to what the system read, its labels and the official registry link", async () => {
		const user = userEvent.setup();
		render(<AdminPorterVerificationsPage />);

		await user.click(await screen.findByRole("button", { name: /Xem & duyệt/ }));
		const section = await screen.findByRole("region", { name: "Thẻ hướng dẫn viên" });
		expect(section).toHaveTextContent("Họ tên không khớp");
		expect(section).toHaveTextContent("Trần Văn Khác");
		expect(screen.getByTestId("declared-card-number")).toHaveTextContent("123456789");
		expect(screen.getByRole("link", { name: /Mở huongdanvien\.vn/ })).toHaveAttribute(
			"href",
			"https://huongdanvien.vn/index.php/guide/cat/05"
		);
	});

	it("requires a reason to reject", async () => {
		const user = userEvent.setup();
		vi.mocked(adminPorterVerificationsService.reject).mockResolvedValue({
			...detail,
			status: "rejected",
			rejectionReason: "Ảnh mờ",
			reviewedAt: "2026-10-17T12:00:00.000Z",
		});
		render(<AdminPorterVerificationsPage />);

		await user.click(await screen.findByRole("button", { name: /Xem & duyệt/ }));
		await user.click(await screen.findByRole("button", { name: /Từ chối/ }));
		const confirm = screen.getByRole("button", { name: "Xác nhận từ chối" });
		expect(confirm).toBeDisabled();

		await user.type(screen.getByPlaceholderText(/Ảnh chứng chỉ bị mờ/), "  Ảnh mờ  ");
		await user.click(confirm);

		expect(adminPorterVerificationsService.reject).toHaveBeenCalledWith("porter-1", "Ảnh mờ");
		expect(await screen.findByText("Đã từ chối hồ sơ của Lý A Porter.")).toBeInTheDocument();
	});
});
