import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Modal } from "../../../shared/components";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import { type ApproveRefundFormData, approveRefundSchema } from "../schema/approve-refund.schema";
import type { AdminRefundItem } from "../types";

interface ApproveRefundModalProps {
	refund: AdminRefundItem | null;
	isSubmitting: boolean;
	onClose: () => void;
	onApprove: (id: string, note?: string) => Promise<void>;
}

export function ApproveRefundModal({
	refund,
	isSubmitting,
	onClose,
	onApprove,
}: ApproveRefundModalProps) {
	const [error, setError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		reset,
		setError: setFieldError,
		formState: { errors },
	} = useForm<ApproveRefundFormData>({
		resolver: zodResolver(approveRefundSchema),
		defaultValues: { note: "" },
	});
	useEffect(() => {
		if (!refund) return;
		reset({ note: "" });
		setError(null);
	}, [refund, reset]);
	if (!refund) return null;
	const submit = handleSubmit(async ({ note }) => {
		if (refund.lateRequest && !note) {
			setFieldError("note", { message: "Cần ghi lý do chấp thuận yêu cầu ngoài thời hạn." });
			return;
		}
		setError(null);
		try {
			await onApprove(refund.id, note || undefined);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Không thể duyệt yêu cầu.");
		}
	});
	return (
		<Modal isOpen onClose={onClose} title="Duyệt yêu cầu hoàn tiền" isCloseDisabled={isSubmitting}>
			<form onSubmit={submit} className="space-y-4">
				<dl className="space-y-3 text-sm">
					<div>
						<dt className="text-[#667a6d]">Khách yêu cầu</dt>
						<dd>{refund.camper.fullName}</dd>
					</div>
					<div>
						<dt className="text-[#667a6d]">Chuyến đi</dt>
						<dd>{refund.tripTitle}</dd>
					</div>
					<div>
						<dt className="text-[#667a6d]">Lý do yêu cầu</dt>
						<dd>{refund.reason}</dd>
					</div>
					<div>
						<dt className="text-[#667a6d]">Số tiền chấp thuận hoàn</dt>
						<dd className="font-semibold">{formatBookingMoney(refund.amount)}</dd>
					</div>
				</dl>
				{refund.lateRequest && (
					<p className="text-sm text-amber-800">
						Yêu cầu gửi ngoài thời hạn 24 giờ. Chỉ chấp thuận khi đã xác minh căn cứ hoàn tiền.
					</p>
				)}
				<p className="text-sm text-[#667a6d]">
					Nếu chuyến đã quyết toán, hệ thống sẽ ghi nhận khoản hoàn hoặc thu hồi từ người tổ chức.
					Sau khi chuyển khoản cho khách, cần xác nhận chuyển tiền riêng.
				</p>
				<div className="space-y-2">
					<label htmlFor="approval-note">
						Lý do chấp thuận{refund.lateRequest ? " *" : " (không bắt buộc)"}
					</label>
					<textarea
						id="approval-note"
						{...register("note")}
						rows={3}
						className="w-full rounded-xl border border-[#dfe8df] p-3 text-sm"
						disabled={isSubmitting}
					/>
					{errors.note && (
						<p role="alert" className="text-sm text-rose-700">
							{errors.note.message}
						</p>
					)}
				</div>
				{error && (
					<p role="alert" className="text-sm text-rose-700">
						{error}
					</p>
				)}
				<div className="flex justify-end gap-3 border-t border-[#dfe8df] pt-4">
					<Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
						Đóng
					</Button>
					<Button type="submit" disabled={isSubmitting}>
						Chấp thuận hoàn tiền
					</Button>
				</div>
			</form>
		</Modal>
	);
}
