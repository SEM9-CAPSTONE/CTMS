export { VIETNAM_POPULAR_BANKS } from "../booking-refund/constants";

export const SETTLEMENT_STATUS_TABS = [
	{ key: "all", label: "Tất cả" },
	{ key: "eligible", label: "Đủ điều kiện quyết toán" },
	{ key: "held", label: "Đang giữ tiền (Chưa đủ 72h)" },
	{ key: "blocked", label: "Bị chặn bởi khiếu nại" },
	{ key: "settled", label: "Đã quyết toán" },
] as const;

export const TRANSACTION_TYPE_LABELS: Record<
	string,
	{ label: string; tone: "green" | "rose" | "blue" }
> = {
	wallet_transfer_credit: { label: "Chuyển số dư vào ví", tone: "green" },
	wallet_transfer_debit: { label: "Chuyển số dư sang ví chính", tone: "rose" },
	settlement_credit: {
		label: "Cộng tiền quyết toán chuyến đi",
		tone: "green",
	},
	payout_debit: {
		label: "Rút tiền về tài khoản ngân hàng",
		tone: "rose",
	},
	payout_refund: {
		label: "Hoàn lại số dư rút tiền bị từ chối",
		tone: "blue",
	},
	penalty_debit: {
		label: "Trừ phạt thời tiết",
		tone: "rose",
	},
	penalty_refund: {
		label: "Hoàn phạt thời tiết đã miễn",
		tone: "green",
	},
	post_settlement_debit: {
		label: "Khấu trừ ví hoàn tiền sau quyết toán",
		tone: "rose",
	},
	post_payout_recovery: {
		label: "Ghi nhận nợ thu hồi sau rút tiền",
		tone: "blue",
	},
};

export const ADJUSTMENT_TYPE_LABELS = {
	post_settlement_refund: "Hoàn tiền sau quyết toán",
	post_payout_recovery: "Thu hồi sau rút tiền",
} as const;

export const ADJUSTMENT_STATUS_TABS = [
	{ key: "all", label: "Tất cả trạng thái" },
	{ key: "pending", label: "Chờ xử lý" },
	{ key: "resolved", label: "Đã xử lý" },
] as const;

export const SETTLEMENT_QUERY_CONFIG = {
	staleTime: 10_000,
	refetchInterval: 30_000,
} as const;
