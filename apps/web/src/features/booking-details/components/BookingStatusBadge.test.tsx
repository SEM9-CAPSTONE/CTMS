import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BookingPaymentStatus, BookingStatus } from "../types";
import { BookingStatusBadge, PaymentStatusBadge } from "./BookingStatusBadge";

describe("BookingStatusBadge", () => {
	it.each([
		["pending_payment", "Chờ thanh toán", "bg-amber-100", "text-amber-900"],
		["pending_reconfirmation", "Chờ xác nhận lại", "bg-amber-100", "text-amber-900"],
		["confirmed", "Đã xác nhận", "bg-emerald-100", "text-emerald-900"],
		["cancelled", "Đã hủy", "bg-slate-100", "text-slate-700"],
		["expired", "Đã hết hạn", "bg-slate-100", "text-slate-700"],
		["completed", "Đã hoàn thành", "bg-sky-100", "text-sky-900"],
	] as Array<[BookingStatus, string, string, string]>)(
		"renders %s with its Vietnamese label and semantic classes",
		(status, label, backgroundClass, textClass) => {
			render(<BookingStatusBadge status={status} testId="booking-status" />);
			const badge = screen.getByTestId("booking-status");
			expect(badge).toHaveTextContent(label);
			expect(badge).toHaveClass(backgroundClass, textClass);
		}
	);

	it("renders a null legacy status as neutral", () => {
		render(<BookingStatusBadge status={null} testId="booking-status" />);
		const badge = screen.getByTestId("booking-status");
		expect(badge).toHaveTextContent("Chưa cập nhật");
		expect(badge).toHaveClass("bg-slate-100", "text-slate-700");
	});
});

describe("PaymentStatusBadge", () => {
	it.each([
		["not_required", "Không yêu cầu thanh toán", "bg-slate-100", "text-slate-700"],
		["unpaid", "Chưa thanh toán", "bg-amber-100", "text-amber-900"],
		["paid", "Đã thanh toán", "bg-emerald-100", "text-emerald-900"],
	] as Array<[BookingPaymentStatus, string, string, string]>)(
		"renders %s with its Vietnamese label and semantic classes",
		(status, label, backgroundClass, textClass) => {
			render(<PaymentStatusBadge status={status} testId="payment-status" />);
			const badge = screen.getByTestId("payment-status");
			expect(badge).toHaveTextContent(label);
			expect(badge).toHaveClass(backgroundClass, textClass);
		}
	);

	it("renders a null legacy status as neutral", () => {
		render(<PaymentStatusBadge status={null} testId="payment-status" />);
		const badge = screen.getByTestId("payment-status");
		expect(badge).toHaveTextContent("Chưa cập nhật");
		expect(badge).toHaveClass("bg-slate-100", "text-slate-700");
	});
});
