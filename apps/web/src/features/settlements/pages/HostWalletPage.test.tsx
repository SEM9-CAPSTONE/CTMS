import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { settlementService } from "../services/settlement.service";
import { HostWalletPage } from "./HostWalletPage";

vi.mock("../services/settlement.service", () => ({
	settlementService: {
		getHostWallet: vi.fn(),
		requestHostPayout: vi.fn(),
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

describe("HostWalletPage", () => {
	it("renders wallet balance and transaction history", async () => {
		vi.mocked(settlementService.getHostWallet).mockResolvedValue({
			id: "wallet-1",
			hostId: "host-1",
			balance: "9500000.00",
			pendingPayout: null,
			transactions: [
				{
					id: "txn-1",
					type: "settlement_credit",
					baseAmount: "10000000.00",
					feeAmount: "500000.00",
					netAmount: "9500000.00",
					balanceAfter: "9500000.00",
					description: "Quyết toán chuyến đi: Trekking Fansipan",
					createdAt: "2030-05-15T12:00:00Z",
				},
			],
		});

		renderWithClient(<HostWalletPage />);

		expect(await screen.findByText("Ví Host & Quản lý Doanh thu")).toBeInTheDocument();
		expect((await screen.findAllByText(/9\.500\.000/)).length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("Rút toàn bộ số dư")).toBeInTheDocument();
		expect(screen.getByText("Quyết toán chuyến đi: Trekking Fansipan")).toBeInTheDocument();
		expect(screen.getByText("Cộng tiền quyết toán chuyến đi")).toBeInTheDocument();
	});

	it("renders pending payout notification when host has a pending payout", async () => {
		vi.mocked(settlementService.getHostWallet).mockResolvedValue({
			id: "wallet-1",
			hostId: "host-1",
			balance: "0.00",
			pendingPayout: {
				id: "payout-1",
				amount: "9500000.00",
				bankName: "Vietcombank",
				accountNumber: "0123456789",
				accountHolderName: "NGUYEN HOST",
				createdAt: "2030-05-15T12:00:00Z",
			},
			transactions: [],
		});

		renderWithClient(<HostWalletPage />);

		expect(await screen.findByText("Đang có 1 yêu cầu rút tiền chờ xử lý")).toBeInTheDocument();
		expect(screen.getByText("Yêu cầu rút tiền đang chờ duyệt")).toBeInTheDocument();
		expect(screen.getByText("0123456789")).toBeInTheDocument();

		const withdrawBtn = screen.getByTestId("request-payout-button");
		expect(withdrawBtn).toBeDisabled();
	});
});
