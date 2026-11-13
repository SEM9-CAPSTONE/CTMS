import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { porterVerificationService } from "../services/porter-verification.service";
import type { PorterVerification, PorterVerificationDocument } from "../types";
import { PorterVerificationPage } from "./PorterVerificationPage";

vi.mock("../services/porter-verification.service", () => ({
	porterVerificationService: {
		getMine: vi.fn(),
		uploadDocument: vi.fn(),
		deleteDocument: vi.fn(),
		updateGuideCard: vi.fn(),
		submit: vi.fn(),
	},
}));

const card = { cardType: "noi_dia" as const, cardNumber: "123456789", expiresOn: "2099-01-01" };

const document: PorterVerificationDocument = {
	id: "doc-1",
	fileUrl: "https://files.test/doc-1.pdf",
	originalName: "chung-chi.pdf",
	mimeType: "application/pdf",
	sizeBytes: 2048,
	uploadedAt: "2026-10-17T10:00:00.000Z",
};

function verification(overrides: Partial<PorterVerification> = {}): PorterVerification {
	return {
		porterId: "porter-1",
		status: "pending_documents",
		submittedAt: null,
		reviewedAt: null,
		rejectionReason: null,
		version: 0,
		guideCard: null,
		documents: [],
		...overrides,
	};
}

function renderPage(onContinue = vi.fn()) {
	render(<PorterVerificationPage onLogout={vi.fn()} onContinue={onContinue} />);
	return { onContinue };
}

describe("PorterVerificationPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uploads a certificate and submits it for review", async () => {
		const user = userEvent.setup();
		vi.mocked(porterVerificationService.getMine).mockResolvedValue(verification());
		vi.mocked(porterVerificationService.uploadDocument).mockResolvedValue(document);
		vi.mocked(porterVerificationService.submit).mockResolvedValue(
			verification({
				status: "pending_review",
				submittedAt: "2026-10-17T11:00:00.000Z",
				version: 2,
				documents: [document],
			})
		);
		renderPage();

		expect(await screen.findByText("Tải lên chứng chỉ dẫn đường")).toBeInTheDocument();
		const submitButton = screen.getByRole("button", { name: /Nộp hồ sơ để duyệt/ });
		expect(submitButton).toBeDisabled();

		const file = new File(["%PDF-1.7"], "chung-chi.pdf", { type: "application/pdf" });
		const input = screen.getByTestId("file-dropzone").querySelector("input") as HTMLInputElement;
		fireEvent.change(input, { target: { files: [file] } });

		expect(await screen.findByText("chung-chi.pdf")).toBeInTheDocument();
		expect(porterVerificationService.uploadDocument).toHaveBeenCalledWith(file);
		// The guide card must be saved before submitting.
		expect(
			screen.getByText("Lưu thông tin thẻ hướng dẫn viên trước khi nộp hồ sơ.")
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Nộp hồ sơ để duyệt/ })).toBeDisabled();

		vi.mocked(porterVerificationService.updateGuideCard).mockResolvedValue(
			verification({ version: 1, guideCard: card, documents: [document] })
		);
		await user.type(screen.getByLabelText("Số thẻ"), "123456789");
		fireEvent.change(screen.getByLabelText("Có giá trị đến"), { target: { value: "2099-01-01" } });
		await user.click(screen.getByRole("button", { name: /Lưu thông tin thẻ/ }));
		expect(porterVerificationService.updateGuideCard).toHaveBeenCalledWith(card);
		expect(await screen.findByText("Đã lưu")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Nộp hồ sơ để duyệt/ }));
		await user.click(screen.getByRole("button", { name: "Nộp hồ sơ" }));

		expect(await screen.findByText("Hồ sơ đang chờ Admin duyệt")).toBeInTheDocument();
		expect(screen.queryByTestId("file-dropzone")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Xóa chung-chi.pdf/ })).not.toBeInTheDocument();
	});

	it("shows the rejection reason and lets the Porter remove files and resubmit", async () => {
		const user = userEvent.setup();
		vi.mocked(porterVerificationService.getMine).mockResolvedValue(
			verification({
				status: "rejected",
				rejectionReason: "Ảnh bị mờ",
				reviewedAt: "2026-10-17T12:00:00.000Z",
				guideCard: card,
				documents: [document],
			})
		);
		vi.mocked(porterVerificationService.deleteDocument).mockResolvedValue(undefined);
		renderPage();

		expect(await screen.findByText("Lý do: Ảnh bị mờ")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Nộp lại hồ sơ/ })).toBeEnabled();

		await user.click(screen.getByRole("button", { name: "Xóa chung-chi.pdf" }));
		await waitFor(() => expect(screen.queryByText("chung-chi.pdf")).not.toBeInTheDocument());
		expect(porterVerificationService.deleteDocument).toHaveBeenCalledWith("doc-1");
		expect(screen.getByRole("button", { name: /Nộp lại hồ sơ/ })).toBeDisabled();
	});

	it("accepts only domestic or international cards with 9 digits and a future expiry", async () => {
		const user = userEvent.setup();
		vi.mocked(porterVerificationService.getMine).mockResolvedValue(verification());
		renderPage();
		await screen.findByText("Tải lên chứng chỉ dẫn đường");

		const options = Array.from(
			(screen.getByLabelText("Loại thẻ") as HTMLSelectElement).options
		).map((option) => option.textContent);
		expect(options).toEqual(["Nội địa", "Quốc tế"]);

		await user.type(screen.getByLabelText("Số thẻ"), "12a345678");
		expect(screen.getByLabelText("Số thẻ")).toHaveValue("12345678");
		fireEvent.change(screen.getByLabelText("Có giá trị đến"), { target: { value: "2099-01-01" } });
		await user.click(screen.getByRole("button", { name: /Lưu thông tin thẻ/ }));
		expect(await screen.findByText("Số thẻ hướng dẫn viên gồm đúng 9 chữ số.")).toBeInTheDocument();
		expect(porterVerificationService.updateGuideCard).not.toHaveBeenCalled();

		await user.type(screen.getByLabelText("Số thẻ"), "9");
		fireEvent.change(screen.getByLabelText("Có giá trị đến"), { target: { value: "2000-01-01" } });
		await user.click(screen.getByRole("button", { name: /Lưu thông tin thẻ/ }));
		expect(await screen.findByText("Thẻ hướng dẫn viên đã hết hạn.")).toBeInTheDocument();
		expect(porterVerificationService.updateGuideCard).not.toHaveBeenCalled();
	});

	it("shows backend upload errors", async () => {
		vi.mocked(porterVerificationService.getMine).mockResolvedValue(verification());
		vi.mocked(porterVerificationService.uploadDocument).mockRejectedValue(
			new HttpError("File PDF không hợp lệ", 400, null)
		);
		renderPage();
		await screen.findByText("Tải lên chứng chỉ dẫn đường");

		const input = screen.getByTestId("file-dropzone").querySelector("input") as HTMLInputElement;
		fireEvent.change(input, {
			target: { files: [new File(["x"], "fake.pdf", { type: "application/pdf" })] },
		});

		expect(await screen.findByText("File PDF không hợp lệ")).toBeInTheDocument();
	});

	it("lets an approved Porter continue to the Porter workspace", async () => {
		const user = userEvent.setup();
		vi.mocked(porterVerificationService.getMine).mockResolvedValue(
			verification({ status: "approved", documents: [document] })
		);
		const { onContinue } = renderPage();

		await user.click(await screen.findByRole("button", { name: "Vào trang Porter" }));
		expect(onContinue).toHaveBeenCalled();
	});
});
