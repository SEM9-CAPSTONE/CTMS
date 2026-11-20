import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PorterCertificateItem } from "../types";
import { AdminRejectDialog } from "./AdminRejectDialog";

describe("AdminRejectDialog", () => {
	const mockCert: PorterCertificateItem = {
		id: "cert-test-1",
		porterId: "porter-1",
		certificateType: "wfa",
		name: "Sơ cấp cứu WFA",
		certificateNumber: "WFA-01",
		issuedBy: "Viện Cứu hộ",
		issueDate: null,
		expiryDate: "2027-01-01",
		fileUrl: "/uploads/certificates/cert.png",
		status: "pending",
		rejectionReason: null,
		verifiedBy: null,
		verifiedAt: null,
		createdAt: "2025-01-01",
		updatedAt: "2025-01-01",
		isExpired: false,
		porter: {
			id: "porter-1",
			fullName: "Nguyễn Minh Sơn",
			email: "porter@ctms.local",
		},
	};

	it("disables submit button when rejection reason is empty and enables when typed", () => {
		const onConfirmReject = vi.fn();
		render(
			<AdminRejectDialog
				isOpen={true}
				onClose={vi.fn()}
				certificate={mockCert}
				onConfirmReject={onConfirmReject}
				isSubmitting={false}
			/>
		);

		const submitBtn = screen.getByRole("button", { name: "Xác nhận từ chối" });
		expect(submitBtn).toBeDisabled();

		const textarea = screen.getByPlaceholderText(
			"Nhập chi tiết lý do không duyệt chứng chỉ này..."
		);
		fireEvent.change(textarea, { target: { value: "Ảnh chụp không hợp lệ" } });
		expect(submitBtn).toBeEnabled();
	});

	it("populates textarea when clicking a preset chip and enables submit button", () => {
		const onConfirmReject = vi.fn().mockResolvedValue(undefined);
		render(
			<AdminRejectDialog
				isOpen={true}
				onClose={vi.fn()}
				certificate={mockCert}
				onConfirmReject={onConfirmReject}
				isSubmitting={false}
			/>
		);

		const submitBtn = screen.getByRole("button", { name: "Xác nhận từ chối" });
		expect(submitBtn).toBeDisabled();

		const presetButton = screen.getByText("Ảnh chụp bị mờ hoặc mất góc");
		fireEvent.click(presetButton);

		// Textarea should now have the preset text
		const textarea = screen.getByPlaceholderText(
			"Nhập chi tiết lý do không duyệt chứng chỉ này..."
		) as HTMLTextAreaElement;
		expect(textarea.value).toBe("Ảnh chụp bị mờ hoặc mất góc");
		expect(submitBtn).toBeEnabled();

		fireEvent.click(submitBtn);
		expect(onConfirmReject).toHaveBeenCalledWith("cert-test-1", "Ảnh chụp bị mờ hoặc mất góc");
	});
});
