import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { bankAccountService } from "../services/bank-account.service";
import { BankAccountList } from "./BankAccountList";

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

describe("BankAccountList", () => {
	beforeAll(() => {
		HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
			this.setAttribute("open", "");
		});
		HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
			this.removeAttribute("open");
		});
	});

	it("renders empty state when user has no accounts", async () => {
		vi.mocked(bankAccountService.getAll).mockResolvedValue([]);

		renderWithClient(<BankAccountList />);

		expect(
			await screen.findByText("Chưa có tài khoản ngân hàng nào được liên kết")
		).toBeInTheDocument();
	});

	it("renders list of bank accounts with default badge", async () => {
		vi.mocked(bankAccountService.getAll).mockResolvedValue([
			{
				id: "acc-1",
				userId: "user-1",
				bankName: "Vietcombank",
				accountNumber: "001100223344",
				accountHolderName: "NGUYEN VAN A",
				isDefault: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			{
				id: "acc-2",
				userId: "user-1",
				bankName: "Techcombank",
				accountNumber: "190311223344",
				accountHolderName: "NGUYEN VAN A",
				isDefault: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);

		renderWithClient(<BankAccountList />);

		expect(await screen.findByText("Vietcombank")).toBeInTheDocument();
		expect(screen.getByText("001100223344")).toBeInTheDocument();
		expect(screen.getByText("Mặc định")).toBeInTheDocument();

		expect(screen.getByText("Techcombank")).toBeInTheDocument();
		expect(screen.getByText("190311223344")).toBeInTheDocument();
		expect(screen.getByText("Đặt làm mặc định")).toBeInTheDocument();
	});

	it("sets account as default when clicking 'Đặt làm mặc định'", async () => {
		const user = userEvent.setup();
		vi.mocked(bankAccountService.getAll).mockResolvedValue([
			{
				id: "acc-2",
				userId: "user-1",
				bankName: "Techcombank",
				accountNumber: "190311223344",
				accountHolderName: "NGUYEN VAN A",
				isDefault: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);
		vi.mocked(bankAccountService.setDefault).mockResolvedValue({
			id: "acc-2",
			userId: "user-1",
			bankName: "Techcombank",
			accountNumber: "190311223344",
			accountHolderName: "NGUYEN VAN A",
			isDefault: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		renderWithClient(<BankAccountList />);

		const setDefaultBtn = await screen.findByRole("button", { name: /Đặt làm mặc định/i });
		await user.click(setDefaultBtn);

		await waitFor(() => {
			expect(bankAccountService.setDefault).toHaveBeenCalledWith("acc-2");
		});
	});

	it("opens ConfirmModal when clicking delete and calls delete API on confirmation", async () => {
		const user = userEvent.setup();
		vi.mocked(bankAccountService.getAll).mockResolvedValue([
			{
				id: "acc-1",
				userId: "user-1",
				bankName: "Vietcombank",
				accountNumber: "001100223344",
				accountHolderName: "NGUYEN VAN A",
				isDefault: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);
		vi.mocked(bankAccountService.delete).mockResolvedValue({ success: true });

		renderWithClient(<BankAccountList />);

		const deleteBtn = await screen.findByRole("button", { name: "Xóa tài khoản" });
		await user.click(deleteBtn);

		expect(screen.getByText("Xóa tài khoản ngân hàng")).toBeInTheDocument();
		expect(screen.getByText(/Bạn có chắc chắn muốn xóa tài khoản/i)).toBeInTheDocument();

		const confirmBtn = screen.getByTestId("confirm-modal-submit");
		await user.click(confirmBtn);

		await waitFor(() => {
			expect(bankAccountService.delete).toHaveBeenCalledWith("acc-1");
		});
	});
});
