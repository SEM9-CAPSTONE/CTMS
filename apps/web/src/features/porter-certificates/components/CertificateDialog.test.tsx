import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PorterCertificateItem } from "../types";
import { CertificateDialog } from "./CertificateDialog";

describe("CertificateDialog", () => {
	const mockRescueCert: PorterCertificateItem = {
		id: "cert-rescue-1",
		porterId: "porter-1",
		type: "rescue",
		certificateType: "rescue",
		name: "Kỹ thuật cứu hộ đường sông",
		certificateNumber: "RIVER-001",
		issuedBy: "Trung tâm Cứu hộ",
		issueDate: "2025-01-01",
		issuedDate: "2025-01-01",
		expiryDate: "2027-01-01",
		fileUrl: "/uploads/certificates/rescue.png",
		status: "rejected",
		rejectionReason: "Ảnh chụp bị mờ không đọc được thông tin",
		verifiedBy: null,
		verifiedAt: null,
		createdAt: "2025-01-01",
		updatedAt: "2025-01-01",
		isExpired: false,
	};

	const mockVerifiedCert: PorterCertificateItem = {
		...mockRescueCert,
		id: "cert-verified-1",
		type: "guide_card",
		certificateType: "guide_card",
		name: "Thẻ hướng dẫn viên du lịch",
		status: "verified",
		rejectionReason: null,
	};

	it("correctly populates the certificate type from existing data (not defaulting to wfa)", () => {
		render(
			<CertificateDialog
				isOpen={true}
				onClose={vi.fn()}
				certificateToEdit={mockRescueCert}
				onSubmit={vi.fn()}
				isSubmitting={false}
			/>
		);

		const typeSelect = screen.getByLabelText(/Loại chứng chỉ/i) as HTMLSelectElement;
		// Must strictly be 'rescue', NOT 'wfa'
		expect(typeSelect.value).toBe("rescue");
		expect(screen.getByDisplayValue("Kỹ thuật cứu hộ đường sông")).toBeInTheDocument();
	});

	it("preserves original type when submitted without changing the select", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(
			<CertificateDialog
				isOpen={true}
				onClose={vi.fn()}
				certificateToEdit={mockRescueCert}
				onSubmit={onSubmit}
				isSubmitting={false}
			/>
		);

		fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

		expect(onSubmit).toHaveBeenCalled();
		const submitted = onSubmit.mock.calls[0][0];
		expect(submitted.certificateType).toBe("rescue");
		expect(submitted.type).toBe("rescue");
	});

	it("shows previous rejection reason when editing a rejected certificate", () => {
		render(
			<CertificateDialog
				isOpen={true}
				onClose={vi.fn()}
				certificateToEdit={mockRescueCert}
				onSubmit={vi.fn()}
				isSubmitting={false}
			/>
		);

		expect(screen.getByText("Lý do từ chối trước đó:")).toBeInTheDocument();
		expect(screen.getByText("Ảnh chụp bị mờ không đọc được thông tin")).toBeInTheDocument();
	});

	it("shows warning banner when editing a verified certificate that edits will revert to pending", () => {
		render(
			<CertificateDialog
				isOpen={true}
				onClose={vi.fn()}
				certificateToEdit={mockVerifiedCert}
				onSubmit={vi.fn()}
				isSubmitting={false}
			/>
		);

		expect(screen.getByText(/Chỉnh sửa sẽ chuyển chứng chỉ về trạng thái/i)).toBeInTheDocument();
		expect(screen.getByText("Chờ duyệt")).toBeInTheDocument();
	});
});
