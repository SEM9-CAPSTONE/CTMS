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
};

export const SETTLEMENT_QUERY_CONFIG = {
	staleTime: 10_000,
	refetchInterval: 30_000,
} as const;
