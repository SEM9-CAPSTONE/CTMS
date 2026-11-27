import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../shared/components";
import { AppRoutes } from "./AppRoutes";

vi.mock("../features/auth/hooks/useSessionCheck", () => ({ useSessionCheck: () => false }));

vi.mock("../features/trips/pages/SearchTripsPage", () => ({
	SearchTripsPage: () => <h1>Khám phá chuyến đi</h1>,
}));

async function waitForRoute() {
	await waitFor(() => {
		expect(document.querySelector('[aria-busy="true"]')).toBeNull();
	});
}

function renderRoutes() {
	return render(
		<ToastProvider>
			<AppRoutes />
		</ToastProvider>
	);
}

describe("AppRoutes public landing pages", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		window.scrollTo = vi.fn();
		window.history.replaceState({}, "", "/");
	});

	it.each([
		["/trekking", "Khám phá các tuyến đường nổi bật trên CTMS"],
		["/safety", "Hệ thống bảo vệ nhiều lớp trên mọi hành trình CTMS"],
		["/about", "Nền tảng tổ chức cắm trại và leo núi an toàn"],
		["/privacy", "Chính sách bảo mật dữ liệu CTMS"],
		["/contact", "Liên hệ và hợp tác vận hành"],
		["/support", "Hướng dẫn sử dụng và câu hỏi thường gặp"],
		["/mobile-app", "Đồng hành trên mọi cung đường ngay cả khi mất sóng"],
	])("renders real CTMS page at %s without 404", async (path, expectedHeading) => {
		window.history.replaceState({}, "", path);
		renderRoutes();
		await waitForRoute();

		expect(await screen.findByRole("heading", { name: expectedHeading })).toBeInTheDocument();
		expect(screen.queryByText(/không tìm thấy trang/i)).not.toBeInTheDocument();
	});

	it("navigates from LandingPage compact 4-item header, hero and footer actions to real pages", async () => {
		const user = userEvent.setup();
		renderRoutes();
		await waitForRoute();

		// HeaderNav has the compact 4-item navigation
		expect(screen.getByRole("link", { name: "Trang chủ" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Khám phá" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Giới thiệu" })).toBeInTheDocument();
		expect(screen.getAllByRole("link", { name: "Chính sách" }).length).toBeGreaterThanOrEqual(1);

		// Hero CTA: Khám phá ngay -> /trips
		await user.click(await screen.findByRole("button", { name: /Khám phá ngay/i }));
		await waitForRoute();
		expect(window.location.pathname).toBe("/trips");
		expect(await screen.findByRole("heading", { name: "Khám phá chuyến đi" })).toBeInTheDocument();

		// HeaderNav: Giới thiệu -> /about
		await user.click(screen.getByRole("link", { name: "Giới thiệu" }));
		await waitForRoute();
		expect(window.location.pathname).toBe("/about");
		expect(
			await screen.findByRole("heading", {
				name: "Nền tảng tổ chức cắm trại và leo núi an toàn",
			})
		).toBeInTheDocument();

		// Footer: Liên hệ -> /contact
		await user.click(screen.getByRole("link", { name: "Liên hệ" }));
		await waitForRoute();
		expect(window.location.pathname).toBe("/contact");
		expect(
			await screen.findByRole("heading", { name: "Liên hệ và hợp tác vận hành" })
		).toBeInTheDocument();

		// Footer: Hỗ trợ -> /support
		await user.click(screen.getByRole("link", { name: "Hỗ trợ" }));
		await waitForRoute();
		expect(window.location.pathname).toBe("/support");
		expect(
			await screen.findByRole("heading", { name: "Hướng dẫn sử dụng và câu hỏi thường gặp" })
		).toBeInTheDocument();
	});

	it("navigates from LandingPage Safety and Mobile buttons to /safety and /mobile-app", async () => {
		const user = userEvent.setup();
		renderRoutes();
		await waitForRoute();

		await user.click(await screen.findByRole("button", { name: "Khám phá tính năng an toàn" }));
		await waitForRoute();
		expect(window.location.pathname).toBe("/safety");

		// Go back to Home and click App Store button
		await user.click(screen.getByRole("link", { name: "Trang chủ" }));
		await waitForRoute();

		await user.click(await screen.findByRole("button", { name: "Tải trên App Store" }));
		await waitForRoute();
		expect(window.location.pathname).toBe("/mobile-app");
		expect(
			await screen.findByRole("heading", { name: "Phiên bản CTMS cho iOS" })
		).toBeInTheDocument();
	});

	it("validates and submits the ContactPage inquiry form with toast feedback", async () => {
		const user = userEvent.setup();
		window.history.replaceState({}, "", "/contact");
		renderRoutes();
		await waitForRoute();

		await user.type(await screen.findByLabelText("Họ và tên"), "Nguyễn Minh Anh");
		await user.type(screen.getByLabelText("Địa chỉ thư điện tử"), "minhanh@example.com");
		await user.type(
			screen.getByLabelText("Nội dung chi tiết"),
			"Tôi muốn tìm hiểu quy trình đăng ký làm đơn vị tổ chức chuyến đi trên CTMS."
		);
		await user.click(screen.getByRole("button", { name: /Gửi yêu cầu liên hệ/i }));

		expect(await screen.findByTestId("toast-success")).toBeInTheDocument();
	});
});
