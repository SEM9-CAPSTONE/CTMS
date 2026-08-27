import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
	type ReviewCampsiteFormValues,
	reviewCampsiteSchema,
} from "../schema/review-campsite.schema";
import type { CreatedCampsite } from "../types";

export interface ReviewCampsiteDialogProps {
	open: boolean;
	campsite: CreatedCampsite | null;
	isSubmitting: boolean;
	errorMessage: string | null;
	onClose: () => void;
	onConfirm: (values: ReviewCampsiteFormValues) => Promise<void>;
}

export function ReviewCampsiteDialog(props: ReviewCampsiteDialogProps) {
	const form = useForm<ReviewCampsiteFormValues>({
		resolver: zodResolver(reviewCampsiteSchema),
		defaultValues: { action: "approve", reason: "" },
	});

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		formState: { errors },
		reset,
	} = form;
	const selectedAction = watch("action");
	const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

	useEffect(() => {
		if (props.open) {
			reset({ action: "approve", reason: "" });
			setActiveImageUrl(null);
		}
	}, [props.open, reset]);

	if (!props.open || !props.campsite) return null;

	const displayName = props.campsite.name || props.campsite.id;

	const submit = handleSubmit(async (values) => {
		await props.onConfirm(values);
	});

	return (
		// biome-ignore lint/a11y/useSemanticElements: custom styled dialog wrapper
		<div
			role="dialog"
			aria-modal="true"
			className="fixed inset-0 z-[60] flex items-center justify-center bg-[#10221b]/50 p-4"
			aria-labelledby="review-campsite-title"
		>
			<div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-[#e0ebe0] px-6 py-4 shrink-0">
					<h2 id="review-campsite-title" className="text-lg font-extrabold text-[#10221b]">
						Duyệt khu cắm trại
					</h2>
					<button
						type="button"
						onClick={props.onClose}
						disabled={props.isSubmitting}
						aria-label="Đóng xác nhận"
						className="rounded-lg p-2 text-[#667a6d] hover:bg-[#f4f7f2] transition-colors"
					>
						<X className="size-5" />
					</button>
				</div>

				<form onSubmit={submit} className="flex-1 flex flex-col min-h-0">
					{/* Scrollable Form Body */}
					<div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
						{/* Campsite Details Brief */}
						<div className="rounded-xl bg-[#f8faf7] border border-[#e5eee7] p-4 space-y-2">
							<h3 className="font-extrabold text-[#164027] text-base">{displayName}</h3>
							<div className="grid grid-cols-2 gap-4 text-xs">
								<div>
									<span className="font-semibold text-[#667a6d] block">Tỉnh thành:</span>
									<span className="font-bold text-[#10221b]">{props.campsite.province}</span>
								</div>
								<div>
									<span className="font-semibold text-[#667a6d] block">Tọa độ:</span>
									<span className="font-bold font-mono text-[#10221b]">
										{props.campsite.latitude.toFixed(6)}, {props.campsite.longitude.toFixed(6)}
									</span>
								</div>
								{props.campsite.operatingHours && (
									<div className="col-span-2">
										<span className="font-semibold text-[#667a6d] block">Giờ hoạt động:</span>
										<span className="font-bold text-[#10221b]">
											{props.campsite.operatingHours.opensAt || "N/A"} -{" "}
											{props.campsite.operatingHours.closesAt || "N/A"}
										</span>
									</div>
								)}
								{props.campsite.description && (
									<div className="col-span-2 border-t border-[#e5eee7] pt-2 mt-1">
										<span className="font-semibold text-[#667a6d] block mb-1">Mô tả:</span>
										<p className="text-[#425048] leading-relaxed text-xs line-clamp-3">
											{props.campsite.description}
										</p>
									</div>
								)}
							</div>
						</div>

						{/* Image preview if any */}
						{props.campsite.media && props.campsite.media.length > 0 && (
							<div className="space-y-2">
								<span className="block text-xs font-bold text-[#425048]">
									Hình ảnh khu cắm trại (Nhấp để phóng to):
								</span>
								<div className="flex gap-2 overflow-x-auto pb-1 max-h-24">
									{props.campsite.media.map((img) => (
										<button
											key={img.id}
											type="button"
											onClick={() => setActiveImageUrl(img.url)}
											className="shrink-0 rounded-lg overflow-hidden border border-[#e5eee7] hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#164027]"
											title="Nhấp để phóng to ảnh"
										>
											<img src={img.url} alt="Preview" className="h-20 w-32 object-cover" />
										</button>
									))}
								</div>
							</div>
						)}

						{/* Action Buttons Selection */}
						<div className="space-y-2">
							<span className="block text-sm font-bold text-[#425048]">Hành động xét duyệt *</span>
							<div className="grid grid-cols-2 gap-4">
								<button
									type="button"
									onClick={() => setValue("action", "approve")}
									className={`flex items-center justify-center gap-2 rounded-xl py-3 border font-extrabold text-sm transition-colors ${
										selectedAction === "approve"
											? "bg-emerald-50 border-emerald-500 text-emerald-800"
											: "border-[#dfe8df] text-[#667a6d] hover:bg-gray-50"
									}`}
								>
									<Check
										className={`size-4 ${selectedAction === "approve" ? "text-emerald-600" : "text-transparent"}`}
									/>
									<span>Phê duyệt</span>
								</button>
								<button
									type="button"
									onClick={() => setValue("action", "decline")}
									className={`flex items-center justify-center gap-2 rounded-xl py-3 border font-extrabold text-sm transition-colors ${
										selectedAction === "decline"
											? "bg-red-50 border-red-500 text-red-800"
											: "border-[#dfe8df] text-[#667a6d] hover:bg-gray-50"
									}`}
								>
									<AlertTriangle
										className={`size-4 ${selectedAction === "decline" ? "text-red-600" : "text-transparent"}`}
									/>
									<span>Từ chối</span>
								</button>
							</div>
						</div>

						{/* Reason textarea for Decline */}
						{selectedAction === "decline" && (
							<div className="space-y-2">
								<label htmlFor="decline-reason" className="block text-sm font-bold text-[#425048]">
									Lý do từ chối *
								</label>
								<textarea
									id="decline-reason"
									{...register("reason")}
									rows={4}
									maxLength={500}
									disabled={props.isSubmitting}
									className="w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 placeholder-gray-400"
									placeholder="Nhập lý do chi tiết từ chối phê duyệt khu cắm trại này để gửi tới Host..."
								/>
								{errors.reason && (
									<span className="block text-xs font-semibold text-red-600">
										{errors.reason.message}
									</span>
								)}
							</div>
						)}

						{/* Backend error display */}
						{props.errorMessage && (
							<div
								role="alert"
								className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
							>
								{props.errorMessage}
							</div>
						)}
					</div>

					{/* Actions Footer */}
					<div className="flex justify-end gap-3 border-t border-[#e0ebe0] px-6 py-4 shrink-0 bg-gray-50 rounded-b-2xl">
						<button
							type="button"
							onClick={props.onClose}
							disabled={props.isSubmitting}
							className="rounded-xl border border-[#dfe8df] px-5 py-2.5 text-sm font-bold text-[#425048] hover:bg-gray-50 disabled:opacity-50 transition-colors"
						>
							Hủy bỏ
						</button>
						<button
							type="submit"
							disabled={props.isSubmitting}
							className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-colors ${
								selectedAction === "approve"
									? "bg-[#164027] hover:bg-[#276143]"
									: "bg-red-600 hover:bg-red-700"
							}`}
						>
							{props.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
							<span>
								{props.isSubmitting
									? "Đang xử lý..."
									: selectedAction === "approve"
										? "Xác nhận duyệt"
										: "Xác nhận từ chối"}
							</span>
						</button>
					</div>
				</form>
			</div>

			{/* Lightbox / Image Dialog */}
			{activeImageUrl && (
				<div
					className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
					onClick={() => setActiveImageUrl(null)}
				>
					<div
						className="relative max-w-3xl max-h-[85vh] overflow-hidden"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							type="button"
							onClick={() => setActiveImageUrl(null)}
							aria-label="Đóng ảnh"
							className="absolute top-3 right-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/75 transition-colors"
						>
							<X className="size-5" />
						</button>
						<img
							src={activeImageUrl}
							alt="Full size view"
							className="max-w-full max-h-[80vh] object-contain rounded-lg"
						/>
					</div>
				</div>
			)}
		</div>
	);
}
