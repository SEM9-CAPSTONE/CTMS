import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { bankAccountService } from "../services/bank-account.service";
import { AddBankAccountDialog } from "./AddBankAccountDialog";

vi.mock("../services/bank-account.service", () => ({
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

describe("AddBankAccountDialog", () => {
	beforeAll(() => {
		HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
			this.setAttribute("open", "");
		});
		HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
			this.removeAttribute("open");
		});
	});

	it("renders dialog and pre-fills uppercase account holder name from userFullName", () => {
		renderWithClient(
			<AddBankAccountDialog open={true} onClose={vi.fn()} userFullName="Nguyễn Văn A" />
		);

		expect(screen.getByText("Thêm tài khoản ngân hàng")).toBeInTheDocument();
		expect(screen.getByDisplayValue("NGUYEN VAN A")).toBeInTheDocument();
	});

	it("submits valid bank account data successfully", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onSuccess = vi.fn();
		const createdAccount = {
			id: "acc-new",
			userId: "u-1",
			bankName: "Vietcombank",
			accountNumber: "123456789",
			accountHolderName: "NGUYEN VAN A",
			isDefault: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		vi.mocked(bankAccountService.create).mockResolvedValue(createdAccount);

		renderWithClient(
			<AddBankAccountDialog
				open={true}
				onClose={onClose}
				onSuccess={onSuccess}
				userFullName="Nguyễn Văn A"
			/>
		);

		const accountNumInput = screen.getByPlaceholderText(/Ví dụ: 0123456789/i);
		await user.type(accountNumInput, "123456789");

		const submitBtn = screen.getByRole("button", { name: "Lưu tài khoản" });
		await user.click(submitBtn);

		await waitFor(() => {
			expect(bankAccountService.create).toHaveBeenCalledTimes(1);
			expect(bankAccountService.create).toHaveBeenCalledWith({
				bankName: "Vietcombank",
				accountNumber: "123456789",
				accountHolderName: "NGUYEN VAN A",
				isDefault: true,
			});
			expect(onSuccess).toHaveBeenCalledWith(createdAccount);
			expect(onClose).toHaveBeenCalledTimes(1);
		});
	});
});
