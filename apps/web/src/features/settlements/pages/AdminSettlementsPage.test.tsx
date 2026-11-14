import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminSettlementsPage } from "./AdminSettlementsPage";

vi.mock("../../admin-refunds/hooks/useApproveRefund", () => ({
	useApproveRefund: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../../shared/components", () => ({
	Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
		<div className={className}>{children}</div>
	),
	Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
	Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
		isOpen ? <div>{children}</div> : null,
}));

vi.mock("../../admin-layout/components/AdminLayout", () => ({
	AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/AdminSettlementsTable", () => ({
	AdminSettlementsTable: () => <div data-testid="settlements-table">Settlements Table</div>,
}));

vi.mock("../components/AdminPayoutsTable", () => ({
	AdminPayoutsTable: () => <div data-testid="payouts-table">Payouts Table</div>,
}));

vi.mock("../../admin-refunds/components/AdminRefundsTable", () => ({
	AdminRefundsTable: () => <div data-testid="refunds-table">Refunds Table</div>,
}));

vi.mock("../components/AdminAdjustmentsTable", () => ({
	AdminAdjustmentsTable: () => <div data-testid="adjustments-table">Adjustments Table</div>,
}));

vi.mock("../components/ConfirmPayoutModal", () => ({
	ConfirmPayoutModal: () => null,
}));

vi.mock("../components/RejectPayoutModal", () => ({
	RejectPayoutModal: () => null,
}));

vi.mock("../components/TripSettlementDetailModal", () => ({
	TripSettlementDetailModal: () => null,
}));

vi.mock("../components/AdminPayoutDetailModal", () => ({
	AdminPayoutDetailModal: () => null,
}));

vi.mock("../components/ReconcileExceptionModal", () => ({
	ReconcileExceptionModal: () => null,
}));

vi.mock("../components/AdjustmentDetailModal", () => ({
	AdjustmentDetailModal: () => null,
}));

vi.mock("../../admin-refunds/components/ConfirmTransferModal", () => ({
	ConfirmTransferModal: () => null,
}));

vi.mock("../../admin-refunds/components/RefundDetailsModal", () => ({
	RefundDetailsModal: () => null,
}));

vi.mock("../../admin-refunds/components/RejectRefundModal", () => ({
	RejectRefundModal: () => null,
}));

vi.mock("../hooks/useSettlements", () => ({
	useReconciliationBookings: () => ({ data: { items: [] }, isLoading: false, isError: false }),
	useAdminSettlements: () => ({
		data: { items: [], total: 0, totalPages: 1 },
		isLoading: false,
		refetch: vi.fn(),
		isFetching: false,
	}),
	useAdminPayouts: () => ({
		data: { items: [], total: 0, totalPages: 1 },
		isLoading: false,
		refetch: vi.fn(),
		isFetching: false,
	}),
	useAdminAdjustments: () => ({
		data: { items: [], total: 0, totalPages: 1 },
		isLoading: false,
		refetch: vi.fn(),
		isFetching: false,
	}),
	useConfirmPayout: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useRejectPayout: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useSettleTrip: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useReconcileException: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useResolveAdjustment: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

vi.mock("../../admin-refunds/hooks/useAdminRefunds", () => ({
	useAdminRefunds: () => ({
		refundsData: { items: [], total: 0, totalPages: 1 },
		isLoading: false,
		isError: false,
		error: null,
		refetch: vi.fn(),
		confirmTransfer: vi.fn(),
		isConfirming: false,
		rejectRefund: vi.fn(),
		isRejecting: false,
	}),
}));

describe("AdminSettlementsPage", () => {
	it("renders page title and 4 tabs without the refund action on the settlement tab", () => {
		render(<AdminSettlementsPage />);

		expect(screen.getByText("Quản lý tài chính")).toBeInTheDocument();
		expect(screen.getByText("Quyết toán chuyến đi")).toBeInTheDocument();
		expect(screen.getByText("Yêu cầu rút tiền Ví Host")).toBeInTheDocument();
		expect(screen.getByText("Hoàn tiền Camper")).toBeInTheDocument();
		expect(screen.getByText("Hoàn tiền sau quyết toán")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Xem yêu cầu hoàn tiền" })).not.toBeInTheDocument();
		expect(screen.getByTestId("settlements-table")).toBeInTheDocument();
	});

	it("switches to Hoàn tiền Camper tab when clicked and renders refunds table", () => {
		render(<AdminSettlementsPage />);

		fireEvent.click(screen.getByText("Hoàn tiền Camper"));

		expect(screen.getByTestId("refunds-table")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Xem yêu cầu hoàn tiền" })).not.toBeInTheDocument();
		expect(screen.queryByTestId("settlements-table")).not.toBeInTheDocument();
	});

	it("switches to Hoàn tiền sau quyết toán tab and renders the records", () => {
		render(<AdminSettlementsPage />);

		fireEvent.click(screen.getByText("Hoàn tiền sau quyết toán"));

		expect(screen.getByTestId("adjustments-table")).toBeInTheDocument();
		expect(screen.queryByTestId("settlements-table")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Xem yêu cầu hoàn tiền" })).toBeVisible();
		for (const tab of ["Quyết toán chuyến đi", "Yêu cầu rút tiền Ví Host", "Hoàn tiền Camper"]) {
			fireEvent.click(screen.getByText(tab));
			expect(
				screen.queryByRole("button", { name: "Xem yêu cầu hoàn tiền" })
			).not.toBeInTheDocument();
		}
	});

	it("renders Hoàn tiền sau quyết toán directly when initialTab='adjustments'", () => {
		render(<AdminSettlementsPage initialTab="adjustments" />);

		expect(screen.getByTestId("adjustments-table")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Xem yêu cầu hoàn tiền" })).toBeVisible();
		expect(screen.queryByTestId("settlements-table")).not.toBeInTheDocument();
	});
});
