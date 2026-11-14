import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, AlertTriangle, Loader2, Scale } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Modal } from "../../../shared/components";
import {
	formatBookingDateTime,
	formatBookingMoney,
} from "../../booking-details/utils/booking-details-formatters";
import {
	type ReconcileExceptionFormData,
	reconcileExceptionSchema,
} from "../schema/reconcile.schema";
import type { ReconciliationBookingOption } from "../types";

export interface ReconcileExceptionModalProps {
	isOpen: boolean;
	isSubmitting: boolean;
	bookings?: ReconciliationBookingOption[];
	isLoadingBookings?: boolean;
	bookingsError?: boolean;
	onSearchBookings?: (search: string) => void;
	onClose: () => void;
	onSubmit: (payload: { bookingId: string; reason: string; notes?: string }) => Promise<void>;
}

export function ReconcileExceptionModal({
	isOpen,
	isSubmitting,
	bookings = [],
	isLoadingBookings = false,
	bookingsError = false,
	onSearchBookings,
	onClose,
	onSubmit,
}: ReconcileExceptionModalProps) {
	const [submitError, setSubmitError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		formState: { errors },
	} = useForm<ReconcileExceptionFormData>({
		resolver: zodResolver(reconcileExceptionSchema),
		defaultValues: {
			bookingId: "",
			reason: "",
			notes: "",
		},
	});

	const handleFormSubmit = async (data: ReconcileExceptionFormData) => {
		setSubmitError(null);
		try {
			await onSubmit({
				bookingId: data.bookingId.trim(),
				reason: data.reason.trim(),
				notes: data.notes?.trim() || undefined,
			});
			reset();
			onClose();
		} catch (err) {
			setSubmitError(
				err instanceof Error
					? err.message
					: "Không thể ghi nhận khoản hoàn. Vui lòng kiểm tra lại thông tin."
			);
		}
	};

	const handleClose = () => {
		if (isSubmitting) return;
		reset();
		setSubmitError(null);
		onClose();
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Xử lý hoàn tiền sau quyết toán"
			icon={<Scale className="size-5" />}
			description="Dùng khi khoản hoàn cho khách đã được chấp thuận nhưng tiền chuyến đi đã quyết toán cho người tổ chức."
			size="lg"
			isCloseDisabled={isSubmitting}
		>
			<form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
				{/* Warning banner */}
				<div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
					<AlertTriangle className="size-4 shrink-0 text-amber-700 mt-0.5" />
					<div className="space-y-1">
						<p className="font-bold text-amber-950">Ghi nhận khoản hoàn và tiền cần thu hồi</p>
						<p className="text-amber-800 leading-relaxed">
							Nếu người tổ chức đã rút tiền, khoản cần thu hồi sẽ được ghi nhận để quản trị viên xử
							lý. Bước này không tự chuyển tiền cho khách. Lịch sử quyết toán và rút tiền được giữ
							nguyên.
						</p>
					</div>
				</div>

				{/* Error feedback */}
				{submitError && (
					<div
						role="alert"
						className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800"
					>
						<AlertCircle className="size-4 shrink-0 text-rose-600" />
						<span>{submitError}</span>
					</div>
				)}

				{/* Booking selection */}
				<div className="space-y-1.5">
					<label htmlFor="reconcile-booking-id" className="block text-xs font-bold text-[#10221b]">
						Đơn đặt chỗ <span className="text-rose-600">*</span>
					</label>
					{onSearchBookings && (
						<input
							aria-label="Tìm đơn đặt chỗ"
							placeholder="Tìm theo tên khách hoặc chuyến đi"
							maxLength={100}
							onChange={(event) => {
								setValue("bookingId", "");
								onSearchBookings(event.target.value);
							}}
							className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2.5 text-xs"
						/>
					)}
					<select
						id="reconcile-booking-id"
						{...register("bookingId")}
						className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2.5 text-xs outline-none transition focus:border-[#164027] focus:ring-1 focus:ring-[#164027]"
						disabled={isSubmitting || isLoadingBookings || bookingsError}
					>
						<option value="">
							{isLoadingBookings ? "Đang tải đơn đặt chỗ..." : "Chọn đơn đặt chỗ"}
						</option>
						{bookings.map((booking) => (
							<option key={booking.id} value={booking.id}>
								{booking.camperName} · {booking.tripTitle} ·{" "}
								{formatBookingDateTime(booking.createdAt)} · {formatBookingMoney(booking.amount)}
							</option>
						))}
					</select>
					{bookingsError && (
						<p role="alert" className="text-xs text-rose-700">
							Không tải được danh sách đơn. Vui lòng đóng và mở lại để thử lại.
						</p>
					)}
					{!isLoadingBookings && !bookingsError && bookings.length === 0 && (
						<p className="text-xs text-[#667a6d]">
							Không tìm thấy đơn đã quyết toán phù hợp. Hãy thử tên khách hoặc chuyến đi khác.
						</p>
					)}
					{errors.bookingId && (
						<p className="text-[11px] font-semibold text-rose-600">{errors.bookingId.message}</p>
					)}
				</div>

				{/* Reason Input */}
				<div className="space-y-1.5">
					<label htmlFor="reconcile-reason" className="block text-xs font-bold text-[#10221b]">
						Lý do hoàn tiền <span className="text-rose-600">*</span>
					</label>
					<textarea
						id="reconcile-reason"
						{...register("reason")}
						rows={3}
						placeholder="Ví dụ: Khiếu nại thu thừa tiền đã được chấp thuận hoàn lại cho khách."
						className="w-full rounded-xl border border-[#dfe8df] p-3 text-xs outline-none transition focus:border-[#164027] focus:ring-1 focus:ring-[#164027]"
						disabled={isSubmitting}
					/>
					{errors.reason && (
						<p className="text-[11px] font-semibold text-rose-600">{errors.reason.message}</p>
					)}
				</div>

				{/* Notes Input */}
				<div className="space-y-1.5">
					<label htmlFor="reconcile-notes" className="block text-xs font-bold text-[#10221b]">
						Ghi chú nội bộ (Tùy chọn)
					</label>
					<textarea
						id="reconcile-notes"
						{...register("notes")}
						rows={2}
						placeholder="Biên bản làm việc hoặc thông tin đối soát bổ sung..."
						className="w-full rounded-xl border border-[#dfe8df] p-3 text-xs outline-none transition focus:border-[#164027] focus:ring-1 focus:ring-[#164027]"
						disabled={isSubmitting}
					/>
					{errors.notes && (
						<p className="text-[11px] font-semibold text-rose-600">{errors.notes.message}</p>
					)}
				</div>

				{/* Actions */}
				<div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e0ebe0]">
					<Button
						type="button"
						variant="outline"
						onClick={handleClose}
						disabled={isSubmitting}
						className="text-xs font-bold"
					>
						Hủy
					</Button>
					<Button
						type="submit"
						disabled={isSubmitting}
						className="bg-[#164027] text-white hover:bg-[#11321f] text-xs font-bold"
					>
						{isSubmitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
						<span>Ghi nhận khoản hoàn</span>
					</Button>
				</div>
			</form>
		</Modal>
	);
}
