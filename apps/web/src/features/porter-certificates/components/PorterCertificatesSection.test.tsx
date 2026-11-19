import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PorterCertificateItem } from "../types";
import { PorterCertificatesSection } from "./PorterCertificatesSection";

// Mock the hook
vi.mock("../hooks/usePorterCertificates");
import { usePorterCertificates } from "../hooks/usePorterCertificates";

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false } },
});

function renderSection() {
	return render(
		<QueryClientProvider client={queryClient}>
			<PorterCertificatesSection />
		</QueryClientProvider>
	);
}

describe("PorterCertificatesSection", () => {
	it("renders empty state when no certificates", () => {
		vi.mocked(usePorterCertificates).mockReturnValue({
			certificates: [],
			isLoading: false,
			errorMessage: null,
			successMessage: null,
			clearMessages: vi.fn(),
			createCertificate: vi.fn(),
			isCreating: false,
			updateCertificate: vi.fn(),
			isUpdating: false,
			deleteCertificate: vi.fn(),
			isDeleting: false,
			reload: vi.fn(),
		});

		renderSection();
		expect(screen.getByText("Chưa có chứng chỉ nào")).toBeInTheDocument();
		expect(screen.getByText("Thêm chứng chỉ đầu tiên")).toBeInTheDocument();
	});

	it("renders certificates with explicit text status badges and handles rejected state", () => {
		const mockCerts: PorterCertificateItem[] = [
			{
				id: "cert-1",
				porterId: "porter-1",
				certificateType: "wfa",
				name: "Sơ cấp cứu hoang dã WFA",
				certificateNumber: "WFA-2025-089",
				issuedBy: "Viện Cứu hộ Việt Nam",
				issueDate: "2025-01-01",
				expiryDate: "2027-01-01",
				fileUrl: "/uploads/certificates/cert-1.png",
				status: "verified",
				rejectionReason: null,
				verifiedBy: "admin-1",
				verifiedAt: "2025-01-02",
				createdAt: "2025-01-01",
				updatedAt: "2025-01-02",
				isExpired: false,
			},
			{
				id: "cert-2",
				porterId: "porter-1",
				certificateType: "rescue",
				name: "Cứu hộ sông suối",
				certificateNumber: "RES-101",
				issuedBy: "Cục Cứu hộ",
				issueDate: "2024-01-01",
				expiryDate: "2026-06-01",
				fileUrl: "/uploads/certificates/cert-2.png",
				status: "rejected",
				rejectionReason: "Ảnh chụp bị mờ số hiệu. Vui lòng nộp lại ảnh rõ nét.",
				verifiedBy: "admin-1",
				verifiedAt: "2025-01-02",
				createdAt: "2025-01-01",
				updatedAt: "2025-01-02",
				isExpired: false,
			},
			{
				id: "cert-3",
				porterId: "porter-1",
				certificateType: "guide_card",
				name: "Thẻ HDV Quốc tế",
				certificateNumber: "HDV-77",
				issuedBy: "Tổng cục Du lịch",
				issueDate: "2022-01-01",
				expiryDate: "2024-01-01",
				fileUrl: "/uploads/certificates/cert-3.png",
				status: "verified",
				rejectionReason: null,
				verifiedBy: "admin-1",
				verifiedAt: "2022-01-02",
				createdAt: "2022-01-01",
				updatedAt: "2022-01-02",
				isExpired: true,
			},
			{
				id: "cert-4",
				porterId: "porter-1",
				certificateType: "other",
				name: "Kỹ năng sinh tồn",
				certificateNumber: null,
				issuedBy: "Hội Dã ngoại",
				issueDate: null,
				expiryDate: "2027-05-01",
				fileUrl: "/uploads/certificates/cert-4.png",
				status: "pending",
				rejectionReason: null,
				verifiedBy: null,
				verifiedAt: null,
				createdAt: "2025-01-01",
				updatedAt: "2025-01-01",
				isExpired: false,
			},
		];

		vi.mocked(usePorterCertificates).mockReturnValue({
			certificates: mockCerts,
			isLoading: false,
			errorMessage: null,
			successMessage: null,
			clearMessages: vi.fn(),
			createCertificate: vi.fn(),
			isCreating: false,
			updateCertificate: vi.fn(),
			isUpdating: false,
			deleteCertificate: vi.fn(),
			isDeleting: false,
			reload: vi.fn(),
		});

		renderSection();

		// Check names
		expect(screen.getByText("Sơ cấp cứu hoang dã WFA")).toBeInTheDocument();
		expect(screen.getByText("Cứu hộ sông suối")).toBeInTheDocument();
		expect(screen.getByText("Thẻ HDV Quốc tế")).toBeInTheDocument();
		expect(screen.getByText("Kỹ năng sinh tồn")).toBeInTheDocument();

		// Check status labels in text
		expect(screen.getByText("Đã xác minh")).toBeInTheDocument();
		expect(screen.getByText("Bị từ chối")).toBeInTheDocument();
		expect(screen.getByText("Hết hạn")).toBeInTheDocument();
		expect(screen.getByText("Chờ duyệt")).toBeInTheDocument();

		// Check rejection reason displayed
		expect(
			screen.getByText("Ảnh chụp bị mờ số hiệu. Vui lòng nộp lại ảnh rõ nét.")
		).toBeInTheDocument();
		expect(screen.getByText("Sửa lại")).toBeInTheDocument();
	});
});
