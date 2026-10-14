import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { bankAccountService } from "../../bank-accounts/services/bank-account.service";
import { HostPayoutModal } from "./HostPayoutModal";

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

describe("HostPayoutModal", () => {
	beforeAll(() => {
		HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
			this.setAttribute("open", "");
		});
		HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
			this.removeAttribute("open");
		});
	});

	it("renders fixed full balance card without custom amount input", () => {
		vi.mocked(bankAccountService.getAll).mockResolvedValue([]);

		renderWithClient(
			<HostPayoutModal
				open={true}
				balance="9500000.00"
				isSubmitting={false}
				onClose={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByText("Yêu cầu rút tiền về ngân hàng")).toBeInTheDocument();
		expect(screen.getByText("Số tiền rút toàn bộ số dư")).toBeInTheDocument();
		expect(screen.getByText("9.500.000 ₫")).toBeInTheDocument();
		expect(screen.getByText("Rút hết 100%")).toBeInTheDocument();

		// Custom amount input must NOT exist
		expect(screen.queryByLabelText(/Số tiền rút/i)).not.toBeInTheDocument();
	});

	it("auto-populates default bank account when accounts are available and submits cleanly", async () => {
		vi.mocked(bankAccountService.getAll).mockResolvedValue([
			{
				id: "bank-1",
				userId: "user-1",
				bankName: "MB Bank (Ngân hàng Quân đội)",
				accountNumber: "9999888877",
				accountHolderName: "NGUYEN VAN HOST",
				isDefault: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);

		const user = userEvent.setup();
		const onSubmit = vi.fn().mockResolvedValue(undefined);

		renderWithClient(
			<HostPayoutModal
				open={true}
				balance="9500000.00"
				isSubmitting={false}
				onClose={vi.fn()}
				onSubmit={onSubmit}
			/>
		);

		// Wait for default bank account to be displayed in read-only card
		expect(await screen.findByText("9999888877")).toBeInTheDocument();
		expect(screen.getByText("NGUYEN VAN HOST")).toBeInTheDocument();
		expect(screen.getByText("MB Bank (Ngân hàng Quân đội)")).toBeInTheDocument();

		const notesInput = screen.getByPlaceholderText(/Ghi chú thêm cho Quản trị viên đối soát.../i);
		await user.type(notesInput, "Rút đợt tháng 5");

		const submitBtn = screen.getByTestId("submit-payout-button");
		await user.click(submitBtn);

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledTimes(1);
			expect(onSubmit).toHaveBeenCalledWith({
				bankName: "MB Bank (Ngân hàng Quân đội)",
				accountNumber: "9999888877",
				accountHolderName: "NGUYEN VAN HOST",
				notes: "Rút đợt tháng 5",
			});
		});
	});

	it("shows warning banner and disables submit button when host has no bank account", async () => {
		vi.mocked(bankAccountService.getAll).mockResolvedValue([]);

		renderWithClient(
			<HostPayoutModal
				open={true}
				balance="9500000.00"
				isSubmitting={false}
				onClose={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(await screen.findByText("Bạn chưa có tài khoản ngân hàng nào")).toBeInTheDocument();
		expect(screen.getByText("Đi đến Hồ sơ cá nhân để thêm tài khoản")).toBeInTheDocument();

		const submitBtn = screen.getByTestId("submit-payout-button");
		expect(submitBtn).toBeDisabled();
	});

	it("disables submit button when balance is 0", async () => {
		vi.mocked(bankAccountService.getAll).mockResolvedValue([
			{
				id: "bank-1",
				userId: "user-1",
				bankName: "MB Bank (Ngân hàng Quân đội)",
				accountNumber: "9999888877",
				accountHolderName: "NGUYEN VAN HOST",
				isDefault: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);

		renderWithClient(
			<HostPayoutModal
				open={true}
				balance="0.00"
				isSubmitting={false}
				onClose={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		const submitBtn = await screen.findByTestId("submit-payout-button");
		expect(submitBtn).toBeDisabled();
	});
});
