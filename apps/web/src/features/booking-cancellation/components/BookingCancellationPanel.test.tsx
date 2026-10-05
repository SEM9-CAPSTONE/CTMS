import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { BookingDetailsPage } from "../../booking-details/pages/BookingDetailsPage";
import { bookingDetailsService } from "../../booking-details/services/booking-details.service";
import type { BookingDetails } from "../../booking-details/types";
import { bookingCancellationService } from "../services/booking-cancellation.service";
import { bookingFixture, cancellationFixture } from "../test-fixtures";
import type { CancelBookingResponse } from "../types";

// This suite uses the real page; other suites mock it with isolate:false.
vi.hoisted(() => vi.resetModules());
const dialogMethods = ["showModal", "close"] as const;
const originalDescriptors = dialogMethods.map((key) =>
	Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key)
);
beforeAll(() => {
	for (const key of dialogMethods)
		Object.defineProperty(HTMLDialogElement.prototype, key, {
			configurable: true,
			writable: true,
			value: () => {},
		});
});
afterAll(() => {
	dialogMethods.forEach((key, index) => {
		const descriptor = originalDescriptors[index];
		if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
		else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
	});
	vi.resetModules();
});
beforeEach(() => {
	vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (
		this: HTMLDialogElement
	) {
		this.setAttribute("open", "");
	});
	vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (
		this: HTMLDialogElement
	) {
		this.removeAttribute("open");
	});
	vi.spyOn(bookingDetailsService, "getBookingDetails").mockResolvedValue(bookingFixture);
	vi.spyOn(bookingCancellationService, "cancel").mockResolvedValue(cancellationFixture);
});
afterEach(() => vi.restoreAllMocks());

async function openDialog() {
	render(<BookingDetailsPage bookingId={bookingFixture.id} onBack={vi.fn()} />);
	fireEvent.click(await screen.findByRole("button", { name: "Yêu cầu hủy đơn" }));
	return screen.getByRole("dialog");
}

it.each([
	["paid", { version: 1, rules: [{ minHoursBeforeTrip: 48, refundPercent: 100 }] }],
	["not_required", { legacy: "unsupported" }],
] as const)(
	"shows advisory action for confirmed/%s independently of policy presentation",
	async (paymentStatus, cancellationPolicySnapshot) => {
		vi.mocked(bookingDetailsService.getBookingDetails).mockResolvedValue({
			...bookingFixture,
			paymentStatus,
			tripStartsAtSnapshot: "2000-01-01T00:00:00Z",
			cancellationPolicySnapshot,
		});
		await openDialog();
		expect(screen.getByText(/Chưa có báo giá hoàn tiền/)).toBeVisible();
		expect(screen.queryByTestId("cancellation-refund-amount")).not.toBeInTheDocument();
		expect(bookingCancellationService.cancel).not.toHaveBeenCalled();
	}
);
it.each([
	["pending_payment", "unpaid"],
	["pending_reconfirmation", "unpaid"],
	["expired", "unpaid"],
	["expired", "paid"],
	["completed", "paid"],
	["cancelled", "paid"],
	[null, "unpaid"],
] as const)("does not offer new cancellation for %s/%s", async (status, paymentStatus) => {
	vi.mocked(bookingDetailsService.getBookingDetails).mockResolvedValue({
		...bookingFixture,
		status,
		paymentStatus,
	});
	render(<BookingDetailsPage bookingId={bookingFixture.id} onBack={vi.fn()} />);
	await screen.findByRole("heading", { name: "Chi tiết đơn đặt chỗ" });
	expect(screen.queryByRole("button", { name: "Yêu cầu hủy đơn" })).not.toBeInTheDocument();
	if (status === "pending_reconfirmation")
		expect(screen.getByText("Trạng thái: Chờ xác nhận lại")).toBeVisible();
	if (status === "cancelled")
		expect(screen.getByText(/Thông tin hoàn tiền không có/)).toBeVisible();
	expect(bookingCancellationService.cancel).not.toHaveBeenCalled();
});
it("opens, focuses, closes and preserves reason when reconsidering", async () => {
	const dialog = await openDialog();
	const reason = screen.getByRole("textbox");
	// Native modal focus/trapping is exercised by Playwright; jsdom only simulates open/close.
	await userEvent.type(reason, "Changed plans");
	fireEvent(dialog, new Event("cancel", { cancelable: true }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Yêu cầu hủy đơn" }));
	expect(screen.getByRole("textbox")).toHaveValue("Changed plans");
	fireEvent.click(screen.getByRole("button", { name: "Giữ đơn đặt chỗ" }));
	expect(bookingCancellationService.cancel).not.toHaveBeenCalled();
});
it("validates the reason before sending", async () => {
	await openDialog();
	fireEvent.change(screen.getByRole("textbox"), { target: { value: "x".repeat(256) } });
	fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
	expect(await screen.findByText("Lý do không được vượt quá 255 ký tự.")).toBeVisible();
	expect(bookingCancellationService.cancel).not.toHaveBeenCalled();
});
it("confirms once, locks pending dialog, reloads details and propagates cancelled state", async () => {
	let resolve!: (value: CancelBookingResponse) => void;
	vi.mocked(bookingCancellationService.cancel).mockImplementation(
		() =>
			new Promise((done) => {
				resolve = done;
			})
	);
	const loaded = vi.fn();
	render(
		<BookingDetailsPage bookingId={bookingFixture.id} onBack={vi.fn()} onBookingLoaded={loaded} />
	);
	fireEvent.click(await screen.findByRole("button", { name: "Yêu cầu hủy đơn" }));
	fireEvent.change(screen.getByRole("textbox"), { target: { value: " reason " } });
	const confirm = screen.getByRole("button", { name: "Xác nhận hủy" });
	fireEvent.click(confirm);
	fireEvent.click(confirm);
	await waitFor(() => expect(bookingCancellationService.cancel).toHaveBeenCalledTimes(1));
	expect(confirm).toBeDisabled();
	fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
	expect(screen.getByRole("dialog")).toBeVisible();
	expect(bookingCancellationService.cancel).toHaveBeenCalledWith(bookingFixture.id, {
		reason: "reason",
	});
	vi.mocked(bookingDetailsService.getBookingDetails).mockResolvedValue({
		...bookingFixture,
		status: "cancelled",
	});
	resolve(cancellationFixture);
	expect(await screen.findByRole("heading", { name: "Đã xác nhận hủy đơn đặt chỗ" })).toBeVisible();
	await waitFor(() => expect(bookingDetailsService.getBookingDetails).toHaveBeenCalledTimes(2));
	expect(screen.getByText("Trạng thái: Đã hủy")).toBeVisible();
	expect(screen.getByTestId("cancellation-refund-amount")).toHaveTextContent("0.51");
	expect(loaded).toHaveBeenLastCalledWith(expect.objectContaining({ status: "cancelled" }));
});
it("keeps confirmed cancellation visible when the follow-up GET fails and retries only GET", async () => {
	await openDialog();
	vi.mocked(bookingDetailsService.getBookingDetails).mockRejectedValueOnce(new Error("GET failed"));
	fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
	expect(
		await screen.findByText(/Kết quả hủy đã xác nhận ở trên vẫn được giữ nguyên/)
	).toBeVisible();
	expect(screen.getByRole("heading", { name: "Đã xác nhận hủy đơn đặt chỗ" })).toBeVisible();
	expect(screen.getByText("Trạng thái: Đã hủy")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Tải lại chi tiết" }));
	await waitFor(() => expect(bookingDetailsService.getBookingDetails).toHaveBeenCalledTimes(3));
	expect(bookingCancellationService.cancel).toHaveBeenCalledTimes(1);
});
it.each([403, 404, 409, 422, 503, "network"] as const)(
	"shows %s without success and preserves input",
	async (status) => {
		vi.mocked(bookingCancellationService.cancel).mockRejectedValue(
			status === "network"
				? new Error("network")
				: new HttpError("bad", status, {
						message: [{ field: "reason", errors: ["reason validation"] }],
					})
		);
		const dialog = await openDialog();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "keep reason" } });
		fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
		await waitFor(() => expect(within(dialog).getAllByRole("alert").length).toBeGreaterThan(0));
		expect(screen.getByRole("textbox")).toHaveValue("keep reason");
		expect(
			screen.queryByRole("heading", { name: "Đã xác nhận hủy đơn đặt chỗ" })
		).not.toBeInTheDocument();
		if (status === 403 || status === 404)
			expect(screen.getByRole("button", { name: "Xác nhận hủy" })).toBeDisabled();
		if (status === 422) expect(screen.getByText("reason validation")).toBeVisible();
		if (status === 503 || status === "network")
			expect(screen.getByText(/Chưa xác nhận được kết quả hủy/)).toBeVisible();
		if (status === 409) {
			fireEvent.click(screen.getByRole("button", { name: "Tải lại thông tin" }));
			await waitFor(() => expect(bookingDetailsService.getBookingDetails).toHaveBeenCalledTimes(2));
			expect(screen.getByRole("textbox")).toHaveValue("keep reason");
		}
	}
);
it("isolates cancellation state when navigating to a different Booking", async () => {
	const view = render(<BookingDetailsPage bookingId={bookingFixture.id} onBack={vi.fn()} />);
	fireEvent.click(await screen.findByRole("button", { name: "Yêu cầu hủy đơn" }));
	fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
	await screen.findByRole("heading", { name: "Đã xác nhận hủy đơn đặt chỗ" });
	const other: BookingDetails = { ...bookingFixture, id: "other" };
	vi.mocked(bookingDetailsService.getBookingDetails).mockResolvedValue(other);
	view.rerender(<BookingDetailsPage bookingId="other" onBack={vi.fn()} />);
	await screen.findByRole("button", { name: "Yêu cầu hủy đơn" });
	expect(
		screen.queryByRole("heading", { name: "Đã xác nhận hủy đơn đặt chỗ" })
	).not.toBeInTheDocument();
});
