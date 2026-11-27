import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../shared/components/Toast";
import { termsService } from "../services/terms.service";
import type { TermsSection, TermsVersionDetail, TermsVersionSummary } from "../types";
import { TermsPage } from "./TermsPage";

vi.mock("../services/terms.service", () => ({
	termsService: {
		getCurrent: vi.fn(),
		listVersions: vi.fn(),
		getVersionByCode: vi.fn(),
		getMyStatus: vi.fn(),
		acceptTerms: vi.fn(),
	},
}));

const SECTION_TITLES = [
	"Quy định chung",
	"Tài khoản và vai trò",
	"Đặt chỗ và thanh toán",
	"Hủy chuyến",
	"Hoạt động trekking",
	"Host và Porter",
	"Bản đồ và dữ liệu thời tiết",
	"Trợ lý sinh tồn AI",
	"SOS và tình huống khẩn cấp",
	"Dữ liệu người dùng",
	"Vi phạm và xử lý tài khoản",
	"Thay đổi điều khoản",
];

function makeSections(): TermsSection[] {
	return SECTION_TITLES.map((title, idx) => ({
		number: idx + 1,
		slug: `section-${idx + 1}`,
		title,
		subsections: [
			{
				code: `${idx + 1}.1`,
				title: `Mục con ${idx + 1}.1`,
				body: `Nội dung chi tiết của mục ${idx + 1}: ${title}.`,
			},
		],
	}));
}

const CURRENT_TERMS: TermsVersionDetail = {
	id: "v10-id",
	version: "1.0",
	title: "Điều khoản và Điều kiện sử dụng CTMS",
	summary: "Phiên bản khởi tạo 12 mục.",
	effectiveDate: "2026-11-27",
	isActive: true,
	requiresReconsent: true,
	publishedAt: "2026-11-27T00:00:00.000Z",
	sections: makeSections(),
};

const OLD_TERMS: TermsVersionDetail = {
	...CURRENT_TERMS,
	id: "v09-id",
	version: "0.9",
	effectiveDate: "2026-09-01",
	isActive: false,
	summary: "Phiên bản thử nghiệm trước đó.",
};

const VERSIONS_LIST: TermsVersionSummary[] = [
	{
		id: CURRENT_TERMS.id,
		version: CURRENT_TERMS.version,
		title: CURRENT_TERMS.title,
		summary: CURRENT_TERMS.summary,
		effectiveDate: CURRENT_TERMS.effectiveDate,
		isActive: true,
		requiresReconsent: true,
		publishedAt: CURRENT_TERMS.publishedAt,
	},
	{
		id: OLD_TERMS.id,
		version: OLD_TERMS.version,
		title: OLD_TERMS.title,
		summary: OLD_TERMS.summary,
		effectiveDate: OLD_TERMS.effectiveDate,
		isActive: false,
		requiresReconsent: true,
		publishedAt: OLD_TERMS.publishedAt,
	},
];

function renderTermsPage(props: Partial<React.ComponentProps<typeof TermsPage>> = {}) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<ToastProvider>
				<TermsPage
					onBackToHome={vi.fn()}
					onNavigateToLogin={vi.fn()}
					onNavigateToRegister={vi.fn()}
					{...props}
				/>
			</ToastProvider>
		</QueryClientProvider>
	);
}

describe("TermsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		sessionStorage.clear();
	});

	it("renders publicly without login, displays version, effective date, TOC and all 12 sections", async () => {
		vi.mocked(termsService.getCurrent).mockResolvedValueOnce(CURRENT_TERMS);

		renderTermsPage();

		expect(await screen.findByText(/Hiệu lực: 27\/11\/2026/)).toBeInTheDocument();
		expect(screen.getByText("Điều khoản và Điều kiện sử dụng CTMS")).toBeInTheDocument();
		expect(screen.getByText("v1.0")).toBeInTheDocument();
		expect(screen.queryByText(/hiện tại/i)).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /lịch sử phiên bản/i })).not.toBeInTheDocument();

		for (let i = 1; i <= 12; i++) {
			expect(
				screen.getByRole("heading", { name: `${i}. ${SECTION_TITLES[i - 1]}` })
			).toBeInTheDocument();
			expect(
				screen.getByRole("link", { name: `${i}. ${SECTION_TITLES[i - 1]}` })
			).toBeInTheDocument();
		}
	});

	it("allows Admin to open version history modal and switch to a historical version", async () => {
		const user = userEvent.setup();
		localStorage.setItem(
			"authUser",
			JSON.stringify({ id: "admin-1", role: "admin", roles: ["admin"] })
		);
		vi.mocked(termsService.getCurrent).mockResolvedValueOnce(CURRENT_TERMS);
		vi.mocked(termsService.listVersions).mockResolvedValueOnce(VERSIONS_LIST);
		vi.mocked(termsService.getVersionByCode).mockResolvedValueOnce(OLD_TERMS);

		renderTermsPage();
		await screen.findByText("v1.0");

		await user.click(screen.getByRole("button", { name: /lịch sử phiên bản/i }));
		expect(await screen.findByText("Lịch sử phiên bản điều khoản")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Xem phiên bản" }));
		await waitFor(() => expect(termsService.getVersionByCode).toHaveBeenCalledWith("0.9"));
		expect(await screen.findByText(/v0\.9 \(cũ\)/)).toBeInTheDocument();
	});

	it("shows back-to-register banner when opened from registration", async () => {
		const user = userEvent.setup();
		const onBackToRegister = vi.fn();
		vi.mocked(termsService.getCurrent).mockResolvedValueOnce(CURRENT_TERMS);

		renderTermsPage({ fromRegister: true, onBackToRegister });
		const backBtn = await screen.findByRole("button", { name: /quay lại đăng ký/i });
		await user.click(backBtn);
		expect(onBackToRegister).toHaveBeenCalledTimes(1);
	});
});
