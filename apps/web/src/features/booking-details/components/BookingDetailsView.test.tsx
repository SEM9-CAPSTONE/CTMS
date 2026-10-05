import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BookingDetails, BookingStatus } from "../types";
import { BookingDetailsView } from "./BookingDetailsView";

const booking: BookingDetails = {
	id: "77777777-7777-4777-8777-777777777777",
	tripId: "33333333-3333-4333-8333-333333333333",
	userId: "11111111-1111-4111-8111-111111111111",
	numPeople: 2,
	status: "pending_payment",
	paymentStatus: "unpaid",
	holdExpiresAt: "2020-01-01T00:15:00.000Z",
	tripStartsAtSnapshot: "2030-02-01T01:00:00.000Z",
	tripEndsAtSnapshot: "2030-02-02T10:00:00.000Z",
	basePrice: "1500000.00",
	totalAmount: "1700000.00",
	cancellationPolicySnapshot: {
		version: 1,
		rules: [{ minHoursBeforeTrip: 48, refundPercent: 100 }],
	},
	createdAt: "2029-12-01T00:00:00.000Z",
	tripPresentation: {
		id: "33333333-3333-4333-8333-333333333333",
		currentTitle: "Summit Trip",
		routeId: "44444444-4444-4444-8444-444444444444",
		currentRouteName: "Ridge Route",
	},
	members: [
		{
			id: "member-1",
			userId: "user-1",
			email: "camper@example.com",
			isPrimary: true,
			memberStatus: "registered",
			createdAt: "2029-12-01T00:01:00.000Z",
			updatedAt: "2029-12-01T00:01:00.000Z",
		},
	],
	equipmentItems: [
		{
			id: "item-1",
			itemType: "equipment",
			equipmentCatalogItemId: "equipment-1",
			quantity: 2,
			unitPrice: "50000.00",
			rentalDays: 2,
			totalPrice: "200000.00",
			createdAt: "2029-12-01T00:02:00.000Z",
			presentation: { currentName: "Trekking Tent" },
		},
	],
};

describe("BookingDetailsView", () => {
	it("renders a context-specific back label", () => {
		render(
			<BookingDetailsView
				booking={booking}
				onBack={() => {}}
				backLabel="Quay lại chi tiết chuyến đi"
			/>
		);
		expect(screen.getByRole("button", { name: "Quay lại chi tiết chuyến đi" })).toBeVisible();
	});

	it("renders the authoritative aggregate and exactly one h1", () => {
		render(<BookingDetailsView booking={booking} onBack={() => {}} />);
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
		expect(screen.getByText(booking.id, { exact: false })).toBeVisible();
		expect(screen.getByText("Chờ thanh toán", { exact: false })).toBeVisible();
		expect(screen.getAllByText("Chưa thanh toán", { exact: false }).length).toBeGreaterThan(0);
		expect(screen.getByText("Summit Trip")).toBeVisible();
		expect(screen.getByText("Ridge Route")).toBeVisible();
		expect(screen.getByText("camper@example.com")).toBeVisible();
		expect(screen.getByText("Người đặt chỗ chính")).toBeVisible();
		expect(screen.getByText("Trekking Tent")).toBeVisible();
		expect(screen.getByTestId("authoritative-total-amount")).toHaveTextContent(/1\.700\.000/);
		expect(
			screen.getByText("Hủy trước ít nhất 48 giờ: hoàn 100% phần tiền đủ điều kiện.")
		).toBeVisible();
		expect(
			screen.getByText(
				"Quyền hủy và số tiền hoàn thực tế được máy chủ xác định tại thời điểm gửi yêu cầu."
			)
		).toBeVisible();
	});

	it.each([
		["pending_payment", "Chờ thanh toán"],
		["confirmed", "Đã xác nhận"],
		["cancelled", "Đã hủy"],
		["expired", "Đã hết hạn"],
		["completed", "Đã hoàn thành"],
	] as Array<[BookingStatus, string]>)("renders %s", (status, label) => {
		render(<BookingDetailsView booking={{ ...booking, status }} onBack={() => {}} />);
		expect(screen.getByText(label, { exact: false })).toBeVisible();
	});

	it("keeps a past pending hold authoritative", () => {
		render(<BookingDetailsView booking={booking} onBack={() => {}} />);
		expect(screen.getByText("Chờ thanh toán", { exact: false })).toBeVisible();
		expect(screen.getByText("Giữ chỗ đến")).toBeVisible();
		expect(screen.queryByText("Đã hết hạn", { exact: false })).not.toBeInTheDocument();
	});

	it.each([
		["unpaid", "Chưa thanh toán"],
		["paid", "Đã thanh toán"],
	] as const)(
		"renders expired/%s status and payment independently",
		(paymentStatus, paymentLabel) => {
			render(
				<BookingDetailsView
					booking={{ ...booking, status: "expired", paymentStatus }}
					onBack={() => {}}
				/>
			);

			expect(screen.getByText("Trạng thái: Đã hết hạn")).toBeVisible();
			expect(screen.getAllByText(paymentLabel, { exact: false }).length).toBeGreaterThan(0);
			expect(screen.getByText("Giữ chỗ đến")).toBeVisible();
			expect(screen.queryByText("Đã xác nhận", { exact: false })).not.toBeInTheDocument();
		}
	);

	it("renders independent legacy and empty states without hiding snapshots", () => {
		render(
			<BookingDetailsView
				booking={{
					...booking,
					numPeople: null,
					status: null,
					paymentStatus: null,
					basePrice: null,
					totalAmount: null,
					holdExpiresAt: null,
					tripPresentation: null,
					members: [],
					equipmentItems: [],
					cancellationPolicySnapshot: null,
				}}
				onBack={() => {}}
			/>
		);
		expect(screen.getAllByText("Chưa cập nhật").length).toBeGreaterThanOrEqual(4);
		expect(screen.getByText("Không còn thông tin tên chuyến đi hiện tại.")).toBeVisible();
		expect(screen.getByText("Chưa có thông tin người tham gia.")).toBeVisible();
		expect(screen.getByText("Đơn đặt chỗ không có thiết bị thuê.")).toBeVisible();
		expect(
			screen.getByText("Chính sách hủy sẽ được hệ thống kiểm tra khi bạn gửi yêu cầu.")
		).toBeVisible();
		expect(screen.getByText("Bắt đầu theo lịch đã đặt")).toBeVisible();
	});

	it("uses safe fallbacks and never recomputes the authoritative total", () => {
		render(
			<BookingDetailsView
				booking={{
					...booking,
					totalAmount: "123456.00",
					members: [{ ...booking.members[0], email: null }],
					equipmentItems: [{ ...booking.equipmentItems[0], presentation: null, quantity: 99 }],
					cancellationPolicySnapshot: { refundHours: 48 },
				}}
				onBack={() => {}}
			/>
		);
		expect(screen.getByText("Không có email hiển thị")).toBeVisible();
		expect(screen.getByText("Thiết bị không còn thông tin hiển thị")).toBeVisible();
		expect(screen.getByTestId("authoritative-total-amount")).toHaveTextContent(/123\.456/);
		expect(
			screen.getByText("Chính sách hủy sẽ được hệ thống kiểm tra khi bạn gửi yêu cầu.")
		).toBeVisible();
		expect(screen.queryByText(/refundHours/)).not.toBeInTheDocument();
		expect(screen.queryByText(/\{\s*"/)).not.toBeInTheDocument();
	});

	it("shows the no-refund-payment note for a free Booking without creating refund data", () => {
		render(
			<BookingDetailsView
				booking={{ ...booking, status: "confirmed", paymentStatus: "not_required" }}
				onBack={() => {}}
			/>
		);
		expect(
			screen.getByText(
				"Đơn đặt chỗ này không yêu cầu thanh toán nên không phát sinh khoản hoàn tiền."
			)
		).toBeVisible();
		expect(screen.queryByTestId("cancellation-refund-amount")).not.toBeInTheDocument();
	});

	it.each([
		{ policy: "legacy prose" },
		{ version: 2, rules: [{ minHoursBeforeTrip: 48, refundPercent: 100 }] },
		{ version: 1, rules: [{ refundPercent: 100 }] },
	])("never renders raw JSON for unsupported policy %#", (snapshot) => {
		render(
			<BookingDetailsView
				booking={{ ...booking, cancellationPolicySnapshot: snapshot }}
				onBack={() => {}}
			/>
		);
		expect(
			screen.getByText("Chính sách hủy sẽ được hệ thống kiểm tra khi bạn gửi yêu cầu.")
		).toBeVisible();
		expect(screen.queryByText(JSON.stringify(snapshot))).not.toBeInTheDocument();
		expect(
			screen.queryByText(/legacy prose|refundPercent|minHoursBeforeTrip/)
		).not.toBeInTheDocument();
	});
});
