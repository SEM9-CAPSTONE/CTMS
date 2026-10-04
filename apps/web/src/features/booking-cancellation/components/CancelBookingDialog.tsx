import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { cancelBookingSchema } from "../schema/cancel-booking.schema";
import type { BookingCancellationError, CancelBookingRequest } from "../types";

interface Props {
	open: boolean;
	isSubmitting: boolean;
	isRefreshing: boolean;
	error: BookingCancellationError | null;
	onSubmit: (input: CancelBookingRequest) => Promise<void>;
	onClose: () => void;
	onReload: () => void;
	onBack: () => void;
}

export function CancelBookingDialog({
	open,
	isSubmitting,
	isRefreshing,
	error,
	onSubmit,
	onClose,
	onReload,
	onBack,
}: Props) {
	const dialog = useRef<HTMLDialogElement>(null);
	const {
		register,
		handleSubmit,
		formState: { errors },
		setFocus,
	} = useForm<CancelBookingRequest>({
		resolver: zodResolver(cancelBookingSchema),
		defaultValues: { reason: "" },
	});
	useEffect(() => {
		const element = dialog.current;
		if (open) {
			element?.showModal();
			setFocus("reason");
		} else element?.close();
		return () => element?.close();
	}, [open, setFocus]);
	const busy = isSubmitting || isRefreshing;
	const terminal = error && ["unauthenticated", "forbidden", "not_found"].includes(error.kind);
	const fieldError = errors.reason?.message ?? error?.reasonError;
	return (
		<dialog
			ref={dialog}
			aria-labelledby="cancel-booking-title"
			aria-describedby="cancel-booking-impact"
			onCancel={(event) => {
				event.preventDefault();
				if (!busy) onClose();
			}}
			className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-rose-200 bg-white p-6 text-[#10221b] shadow-xl backdrop:bg-black/50"
		>
			<h2 id="cancel-booking-title" className="text-xl font-extrabold">
				Xác nhận hủy đơn đặt chỗ
			</h2>
			<p id="cancel-booking-impact" className="mt-3 text-sm">
				Nếu máy chủ chấp nhận, toàn bộ đơn đặt chỗ sẽ bị hủy và người tham gia trong đơn không còn
				quyền tham gia chuyến đi.
			</p>
			<p className="mt-2 text-sm">
				Máy chủ quyết định điều kiện hủy và kết quả hoàn tiền. Chưa có báo giá hoàn tiền trước khi
				xác nhận.
			</p>
			<form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
				<label htmlFor="cancel-booking-reason" className="block text-sm font-bold">
					Lý do (không bắt buộc)
				</label>
				<textarea
					{...register("reason")}
					id="cancel-booking-reason"
					maxLength={255}
					disabled={busy}
					aria-invalid={Boolean(fieldError)}
					aria-describedby={fieldError ? "cancel-reason-error" : undefined}
					className="w-full rounded-xl border border-[#cbd9ce] p-3"
					rows={3}
				/>
				{fieldError && (
					<p id="cancel-reason-error" role="alert" className="text-sm text-rose-700">
						{fieldError}
					</p>
				)}
				{error && (
					<div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
						{error.message}
					</div>
				)}
				<div className="flex flex-wrap justify-end gap-3">
					<button
						type="button"
						disabled={busy}
						onClick={onClose}
						className="rounded-xl border px-4 py-2 disabled:opacity-50"
					>
						Giữ đơn đặt chỗ
					</button>
					{error?.kind === "not_found" && (
						<button type="button" onClick={onBack} className="rounded-xl border px-4 py-2">
							Quay lại danh sách
						</button>
					)}
					{error && !terminal && (
						<button
							type="button"
							disabled={busy}
							onClick={onReload}
							className="rounded-xl border px-4 py-2 disabled:opacity-50"
						>
							{isRefreshing ? "Đang tải lại..." : "Tải lại thông tin"}
						</button>
					)}
					<button
						type="submit"
						disabled={busy || Boolean(terminal)}
						className="rounded-xl bg-rose-700 px-4 py-2 font-bold text-white disabled:opacity-50"
					>
						{isSubmitting
							? "Đang gửi yêu cầu..."
							: error?.kind === "uncertain"
								? "Gửi lại yêu cầu hủy"
								: "Xác nhận hủy"}
					</button>
				</div>
			</form>
		</dialog>
	);
}
