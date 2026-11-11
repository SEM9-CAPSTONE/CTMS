import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RefundStateBadge } from "./RefundStateBadge";

describe("RefundStateBadge", () => {
	it("renders pending badge without fabricating success", () => {
		render(<RefundStateBadge status="pending" />);
		const badge = screen.getByTestId("refund-status-badge-pending");
		expect(badge).toHaveTextContent("Đang xử lý");
	});

	it("renders succeeded badge accurately", () => {
		render(<RefundStateBadge status="succeeded" />);
		const badge = screen.getByTestId("refund-status-badge-succeeded");
		expect(badge).toHaveTextContent("Đã hoàn tiền");
	});

	it("renders failed badge with actionable text", () => {
		render(<RefundStateBadge status="failed" />);
		const badge = screen.getByTestId("refund-status-badge-failed");
		expect(badge).toHaveTextContent("Thất bại (cần thử lại)");
	});

	it("renders settlement blocked badge", () => {
		render(<RefundStateBadge status="blocked" />);
		const badge = screen.getByTestId("refund-status-badge-blocked");
		expect(badge).toHaveTextContent("Tạm giữ quyết toán");
	});

	it("renders awaiting resolution badge", () => {
		render(<RefundStateBadge status="awaiting_resolution" />);
		const badge = screen.getByTestId("refund-status-badge-awaiting_resolution");
		expect(badge).toHaveTextContent("Đang chờ giải quyết khiếu nại");
	});
});
