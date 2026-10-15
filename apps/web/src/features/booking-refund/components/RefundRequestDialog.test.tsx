import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { bankAccountService } from "../../bank-accounts/services/bank-account.service";
import { RefundRequestDialog } from "./RefundRequestDialog";

vi.mock("../../bank-accounts/services/bank-account.service", () => ({
	bankAccountService: {
		getAll: vi.fn(),
		create: vi.fn(),
		delete: vi.fn(),
		setDefault: vi.fn(),
	},
}));

function renderWithClient(ui: React.ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
	return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("RefundRequestDialog", () => {
	beforeAll(() => {
		HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
			this.setAttribute("open", "");
		});
		HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
			this.removeAttribute("open");
		});
	});

	it("renders dialog and submits valid form data with default bank account", async () => {
		vi.mocked(bankAccountService.getAll).mockResolvedValue([
			{
				id: "bank-1",
				userId: "user-1",
				bankName: "Vietcombank",
				accountNumber: "1029384756",
				accountHolderName: "CAMPER NGUYEN VAN AN",
				isDefault: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);

		const user = userEvent.setup();
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const onClose = vi.fn();

		renderWithClient(
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
		expect(await screen.findByText("Vietcombank")).toBeInTheDocument();
		expect(screen.getByText("1029384756")).toBeInTheDocument();
		expect(screen.getByText("CAMPER NGUYEN VAN AN")).toBeInTheDocument();

		const reasonInput = screen.getByPlaceholderText(/Mô tả chi tiết lý do yêu cầu hoàn tiền/i);
		await user.type(reasonInput, "Chuyến đi bị hoãn do thiên tai bất khả kháng");

		const submitBtn = screen.getByTestId("submit-refund-button");
		await user.click(submitBtn);

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledTimes(1);
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					reason: "Chuyến đi bị hoãn do thiên tai bất khả kháng",
					bankName: "Vietcombank",
					accountNumber: "1029384756",
					accountHolderName: "CAMPER NGUYEN VAN AN",
				})
			);
		});
	});

	it("disables submit button and shows warning banner when user has no bank account", async () => {
		vi.mocked(bankAccountService.getAll).mockResolvedValue([]);

		renderWithClient(
			<RefundRequestDialog
				open={true}
				isSubmitting={false}
				error={null}
				onSubmit={vi.fn()}
				onClose={vi.fn()}
				onClearError={vi.fn()}
			/>
		);

		expect(await screen.findByText("Bạn chưa có tài khoản ngân hàng nào")).toBeInTheDocument();
		expect(screen.getByText("Đi đến Hồ sơ cá nhân để thêm tài khoản")).toBeInTheDocument();

		const submitBtn = screen.getByTestId("submit-refund-button");
		expect(submitBtn).toBeDisabled();
	});

	it("shows validation error when reason is too short", async () => {
		vi.mocked(bankAccountService.getAll).mockResolvedValue([
			{
				id: "bank-1",
				userId: "user-1",
				bankName: "Vietcombank",
				accountNumber: "1029384756",
				accountHolderName: "CAMPER NGUYEN VAN AN",
				isDefault: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);

		const user = userEvent.setup();
		const onSubmit = vi.fn();

		renderWithClient(
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
		vi.mocked(bankAccountService.getAll).mockResolvedValue([
			{
				id: "bank-1",
				userId: "user-1",
				bankName: "Vietcombank",
				accountNumber: "1029384756",
				accountHolderName: "CAMPER NGUYEN VAN AN",
				isDefault: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);

		renderWithClient(
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
		vi.mocked(bankAccountService.getAll).mockResolvedValue([]);

		renderWithClient(
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

	it("displays fixed full refundable amount and submits full amount without amount input", async () => {
		vi.mocked(bankAccountService.getAll).mockResolvedValue([
			{
				id: "bank-camper-1",
				userId: "user-camper",
				bankName: "Techcombank",
				accountNumber: "1903678910",
				accountHolderName: "NGUYEN VAN CAMPER",
				isDefault: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);

		const user = userEvent.setup();
		const onSubmit = vi.fn().mockResolvedValue(undefined);

		renderWithClient(
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

		expect(screen.getByText("Số tiền hoàn toàn bộ (100%)")).toBeInTheDocument();
		expect(screen.getByText("500.000 ₫")).toBeInTheDocument();
		expect(screen.getByText("Rút hết")).toBeInTheDocument();
		expect(screen.queryByLabelText(/Số tiền yêu cầu hoàn/i)).not.toBeInTheDocument();

		// Auto filled default bank account
		expect(await screen.findByText("1903678910")).toBeInTheDocument();
		expect(screen.getByText("NGUYEN VAN CAMPER")).toBeInTheDocument();

		const reasonInput = screen.getByPlaceholderText(/Mô tả chi tiết lý do yêu cầu hoàn tiền/i);
		await user.type(reasonInput, "Lý do hủy hoàn tất chuyến đi");

		const submitBtn = screen.getByTestId("submit-refund-button");
		await user.click(submitBtn);

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledTimes(1);
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					amount: "500000",
					bankName: "Techcombank",
					accountNumber: "1903678910",
					accountHolderName: "NGUYEN VAN CAMPER",
				})
			);
		});
	});
});
