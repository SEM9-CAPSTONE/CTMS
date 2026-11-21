import type { BookingRefundItem } from "../types";
import type { RefundFlow } from "../utils/refund-flow";

export function RefundProgress({
	refunds,
	flow,
}: {
	refunds: BookingRefundItem[];
	flow: Pick<RefundFlow, "automatic" | "firstStep">;
}) {
	const { firstStep } = flow;
	const active = refunds.find((refund) => refund.status === "pending") ?? refunds[0];
	const paid = active?.status === "succeeded";
	const rejected = active?.reviewStatus === "rejected";
	const approved = Boolean(
		active &&
			!rejected &&
			(active.reviewStatus === "approved" || active.reviewStatus == null || paid)
	);
	const transferFailed = active?.status === "failed" && !rejected;
	let reviewStatus = active ? "Đang xem xét" : "Quản trị viên thực hiện";
	if (approved) reviewStatus = "Đã chấp thuận";
	if (rejected) reviewStatus = "Đã từ chối";
	let transferStatus = approved ? "Chờ chuyển khoản" : "Sau khi được chấp thuận";
	if (transferFailed) transferStatus = "Chuyển tiền chưa thành công";
	if (rejected) transferStatus = "Không chuyển tiền";
	if (paid) transferStatus = "Đã chuyển tiền";
	const steps = [
		{
			label: firstStep.label,
			status: active ? firstStep.done : firstStep.todo,
			done: flow.automatic || Boolean(active),
		},
		{
			label: "Xét duyệt",
			status: reviewStatus,
			done: approved,
		},
		{
			label: "Nhận tiền hoàn",
			status: transferStatus,
			done: paid,
		},
	];
	return (
		<ol
			aria-label="Các bước nhận tiền hoàn"
			className="grid gap-4 border-y border-[#dfe8df] py-4 sm:grid-cols-3"
		>
			{steps.map((step, index) => (
				<li key={step.label} className="space-y-1">
					<p className={`text-sm font-semibold ${step.done ? "text-[#164027]" : "text-[#10221b]"}`}>
						{index + 1}. {step.label}
					</p>
					<p className="text-xs text-[#667a6d]">{step.status}</p>
				</li>
			))}
		</ol>
	);
}
