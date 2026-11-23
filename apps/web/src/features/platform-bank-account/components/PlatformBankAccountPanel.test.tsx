import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import type { platformBankAccountService } from "../services/platform-bank-account.service";
import type { PlatformBankAccount } from "../types";
import { PlatformBankAccountPanel } from "./PlatformBankAccountPanel";

const SAVED: PlatformBankAccount = {
	purpose: "weather_penalty",
	bankName: "Vietcombank",
	accountNumber: "1028374659",
	accountHolderName: "CONG TY TNHH CTMS VIET NAM",
	updatedAt: "2030-01-05T03:00:00.000Z",
	updatedByName: "Lê Minh Tuấn",
};

function service(account: PlatformBankAccount | null, save = vi.fn()) {
	return {
		get: vi.fn().mockResolvedValue({ account }),
		save,
	} as unknown as typeof platformBankAccountService & Record<string, ReturnType<typeof vi.fn>>;
}

function renderPanel(api: ReturnType<typeof service>) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(
		<QueryClientProvider client={client}>
			<PlatformBankAccountPanel service={api} />
		</QueryClientProvider>
	);
}

afterEach(() => vi.restoreAllMocks());

it("asks for an account when none is set and validates it before saving", async () => {
	const save = vi.fn().mockResolvedValue({ ...SAVED, bankName: "BIDV" });
	const api = service(null, save);
	renderPanel(api);
	const form = await screen.findByTestId("platform-bank-account-form");
	expect(form).toHaveTextContent("Chưa có tài khoản nhận tiền phạt");

	fireEvent.change(within(form).getByLabelText("Số tài khoản"), { target: { value: "123" } });
	fireEvent.click(within(form).getByRole("button", { name: "Lưu tài khoản" }));
	expect(form).toHaveTextContent("Số tài khoản phải từ 6 ký tự trở lên");
	expect(form).toHaveTextContent("Tên chủ tài khoản phải từ 2 ký tự trở lên");
	expect(save).not.toHaveBeenCalled();

	fireEvent.change(within(form).getByLabelText("Ngân hàng"), { target: { value: "BIDV" } });
	fireEvent.change(within(form).getByLabelText("Số tài khoản"), {
		target: { value: " 31410001234567 " },
	});
	fireEvent.change(within(form).getByLabelText("Tên chủ tài khoản"), {
		target: { value: "cong ty tnhh ctms viet nam" },
	});
	fireEvent.click(within(form).getByRole("button", { name: "Lưu tài khoản" }));
	const confirm = await screen.findByTestId("confirm-modal");
	expect(confirm).toHaveTextContent("BIDV · 31410001234567 · CONG TY TNHH CTMS VIET NAM");
	fireEvent.click(within(confirm).getByRole("button", { name: "Lưu" }));
	await waitFor(() =>
		expect(save).toHaveBeenCalledWith({
			bankName: "BIDV",
			accountNumber: "31410001234567",
			accountHolderName: "CONG TY TNHH CTMS VIET NAM",
		})
	);
	expect(await screen.findByTestId("platform-bank-account-current")).toHaveTextContent("BIDV");
});

it("shows the current account with who changed it, and edits it", async () => {
	const save = vi.fn().mockResolvedValue({ ...SAVED, accountNumber: "1028374660" });
	const api = service(SAVED, save);
	renderPanel(api);
	const current = await screen.findByTestId("platform-bank-account-current");
	expect(current).toHaveTextContent("1028374659");
	expect(current).toHaveTextContent("bởi Lê Minh Tuấn");
	expect(screen.queryByTestId("platform-bank-account-form")).not.toBeInTheDocument();

	fireEvent.click(screen.getByRole("button", { name: "Đổi tài khoản" }));
	const form = screen.getByTestId("platform-bank-account-form");
	expect(within(form).getByLabelText("Số tài khoản")).toHaveValue("1028374659");
	fireEvent.change(within(form).getByLabelText("Số tài khoản"), {
		target: { value: "1028374660" },
	});
	fireEvent.click(within(form).getByRole("button", { name: "Lưu tài khoản" }));
	fireEvent.click(
		within(await screen.findByTestId("confirm-modal")).getByRole("button", { name: "Lưu" })
	);
	await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
	expect(await screen.findByTestId("platform-bank-account-current")).toHaveTextContent(
		"1028374660"
	);
});

it("keeps the form open when the server refuses the account", async () => {
	const save = vi.fn().mockRejectedValue(new HttpError("Unprocessable", 422, { message: [] }));
	const api = service(SAVED, save);
	renderPanel(api);
	fireEvent.click(await screen.findByRole("button", { name: "Đổi tài khoản" }));
	fireEvent.click(screen.getByRole("button", { name: "Lưu tài khoản" }));
	fireEvent.click(
		within(await screen.findByTestId("confirm-modal")).getByRole("button", { name: "Lưu" })
	);
	await waitFor(() => expect(save).toHaveBeenCalled());
	expect(screen.getByTestId("platform-bank-account-form")).toBeInTheDocument();
});
