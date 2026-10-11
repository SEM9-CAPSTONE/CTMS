import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { RefundRequestDialog } from "./RefundRequestDialog";

describe("RefundRequestDialog", () => {
	beforeAll(() => {
		HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
			this.setAttribute("open", "");
		});
		HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
			this.removeAttribute("open");
		});
	});

	it("renders dialog and submits valid form data", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const onClose = vi.fn();

		render(
			<RefundRequestDialog
				open={true}
				isSubmitting={false}
				error={null}
				maxRefundableAmount="500000.00"
				onSubmit={onSubmit}
				onClose={onClose}
				onClearError={vi.fn()}
			/>
		);

		expect(screen.getByText("Yêu cầu hoàn tiền & Khiếu nại")).toBeInTheDocument();

		const reasonInput = screen.getByPlaceholderText(/Mô tả chi tiết lý do yêu cầu hoàn tiền/i);
		await user.type(reasonInput, "Chuyến đi bị hoãn do thiên tai bất khả kháng");

		const submitBtn = screen.getByTestId("submit-refund-button");
		await user.click(submitBtn);

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledTimes(1);
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					reason: "Chuyến đi bị hoãn do thiên tai bất khả kháng",
				})
			);
		});
	});

	it("shows validation error when reason is too short", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<RefundRequestDialog
				open={true}
				isSubmitting={false}
				error={null}
				onSubmit={onSubmit}
				onClose={vi.fn()}
				onClearError={vi.fn()}
			/>
		);

		const reasonInput = screen.getByPlaceholderText(/Mô tả chi tiết lý do yêu cầu hoàn tiền/i);
		await user.type(reasonInput, "Lỗi");

		const submitBtn = screen.getByTestId("submit-refund-button");
		await user.click(submitBtn);

		expect(await screen.findByText("Lý do phải có ít nhất 5 ký tự")).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("disables submit button and shows loading when isSubmitting is true", () => {
		render(
			<RefundRequestDialog
				open={true}
				isSubmitting={true}
				error={null}
				onSubmit={vi.fn()}
				onClose={vi.fn()}
				onClearError={vi.fn()}
			/>
		);

		const submitBtn = screen.getByTestId("submit-refund-button");
		expect(submitBtn).toBeDisabled();
		expect(submitBtn).toHaveTextContent("Đang gửi yêu cầu...");
	});

	it("renders server error alert when error is provided", () => {
		render(
			<RefundRequestDialog
				open={true}
				isSubmitting={false}
				error={{
					kind: "conflict_window",
					message: "Yêu cầu nằm ngoài khung thời gian chính sách cho phép",
					canRetry: false,
				}}
				onSubmit={vi.fn()}
				onClose={vi.fn()}
				onClearError={vi.fn()}
			/>
		);

		expect(
			screen.getByText("Yêu cầu nằm ngoài khung thời gian chính sách cho phép")
		).toBeInTheDocument();
	});

	it("caps amount to maximum refundable amount and fills max on clicking max button", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn().mockResolvedValue(undefined);

		render(
			<RefundRequestDialog
				open={true}
				isSubmitting={false}
				error={null}
				maxRefundableAmount="500000.00"
				onSubmit={onSubmit}
				onClose={vi.fn()}
				onClearError={vi.fn()}
			/>
		);

		const amountInput = screen.getByLabelText(/Số tiền yêu cầu hoàn/i);
		expect(amountInput).toHaveValue("500000");

		// If user types an amount larger than max, it is automatically capped
		await user.clear(amountInput);
		await user.type(amountInput, "9999999");
		expect(amountInput).toHaveValue("500000");

		// Clicking the 'Tối đa' button fills maximum amount
		await user.clear(amountInput);
		await user.type(amountInput, "200000");
		expect(amountInput).toHaveValue("200000");

		const maxBtn = screen.getByRole("button", { name: "Tối đa" });
		await user.click(maxBtn);
		expect(amountInput).toHaveValue("500000");
	});
});
