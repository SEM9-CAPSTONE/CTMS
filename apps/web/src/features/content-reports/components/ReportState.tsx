import { StatusBadge } from "../../../shared/components/StatusBadge";
export function ReportState({ status }: { status: string }) {
	switch (status) {
		case "pending":
			return <StatusBadge tone="warning">Chờ xem xét</StatusBadge>;
		case "reviewing":
			return <StatusBadge tone="info">Đang xem xét</StatusBadge>;
		case "actioned":
			return <StatusBadge tone="neutral">Đã xử lý</StatusBadge>;
		case "rejected":
			return <StatusBadge tone="neutral">Không được chấp nhận</StatusBadge>;
		default:
			return <StatusBadge tone="neutral">Chưa có trạng thái</StatusBadge>;
	}
}
