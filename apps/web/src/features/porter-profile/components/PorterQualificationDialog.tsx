import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, Loader2, MapPin, X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { PROFICIENCY_DESCRIPTIONS, PROFICIENCY_LABELS } from "../constants";
import {
	type PorterRouteQualificationFormValues,
	porterRouteQualificationSchema,
} from "../schema/porter-route-qualification.schema";
import type { PorterRouteProficiency, PorterRouteQualification } from "../types";

interface RouteOption {
	id: string;
	name: string;
}

interface PorterQualificationDialogProps {
	isOpen: boolean;
	onClose: () => void;
	qualification: PorterRouteQualification | null; // null means create mode
	existingRouteIds: string[];
	availableRoutes: RouteOption[];
	onSubmit: (
		routeId: string,
		values: {
			proficiency: PorterRouteProficiency;
			timesLed: number;
			expectedVersion?: number;
		}
	) => Promise<boolean>;
	isSubmitting: boolean;
}

export function PorterQualificationDialog({
	isOpen,
	onClose,
	qualification,
	existingRouteIds,
	availableRoutes,
	onSubmit,
	isSubmitting,
}: PorterQualificationDialogProps) {
	const isEditMode = Boolean(qualification);
	const isCurrentlyVerified = Boolean(qualification?.verifiedBy && qualification?.verifiedAt);

	const form = useForm<PorterRouteQualificationFormValues>({
		resolver: zodResolver(porterRouteQualificationSchema),
		defaultValues: {
			routeId: qualification?.routeId || "",
			proficiency: qualification?.proficiency || "learning",
			timesLed: qualification ? qualification.timesLed : 0,
		},
	});

	const {
		register,
		watch,
		setValue,
		handleSubmit,
		reset,
		formState: { errors },
	} = form;

	const selectedProficiency = watch("proficiency");

	useEffect(() => {
		if (isOpen) {
			reset({
				routeId: qualification?.routeId || (availableRoutes[0]?.id ?? ""),
				proficiency: qualification?.proficiency || "learning",
				timesLed: qualification ? qualification.timesLed : 0,
			});
		}
	}, [isOpen, qualification, availableRoutes, reset]);

	if (!isOpen) return null;

	const handleFormSubmit = async (values: PorterRouteQualificationFormValues) => {
		const targetRouteId = isEditMode && qualification ? qualification.routeId : values.routeId;
		const payload = {
			proficiency: values.proficiency,
			timesLed: values.timesLed,
			expectedVersion: isEditMode && qualification ? qualification.version : undefined,
		};

		const success = await onSubmit(targetRouteId, payload);
		if (success) {
			onClose();
		}
	};

	// Routes available to add (not yet in existing qualifications, unless in edit mode)
	const filteredRoutes = availableRoutes.filter(
		(r) => !existingRouteIds.includes(r.id) || (isEditMode && r.id === qualification?.routeId)
	);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
			<div
				data-testid="qualification-dialog"
				className="w-full max-w-lg rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-xl sm:p-8"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-[#e7eee7] pb-4">
					<div className="flex items-center gap-2.5">
						<div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-[#164027]">
							<MapPin size={18} />
						</div>
						<h3 className="text-lg font-extrabold text-[#10221b]">
							{isEditMode ? "Chỉnh sửa chứng chỉ tuyến" : "Thêm chứng chỉ tuyến trekking"}
						</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						disabled={isSubmitting}
						aria-label="Đóng"
						className="rounded-xl p-2 text-[#667a6d] hover:bg-[#f1f5f0]"
					>
						<X size={18} />
					</button>
				</div>

				<form onSubmit={handleSubmit(handleFormSubmit)} className="mt-6 flex flex-col gap-5">
					{/* Verified Edit Warning */}
					{isEditMode && isCurrentlyVerified && (
						<div
							data-testid="verified-edit-warning"
							className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-medium text-amber-900 shadow-xs"
						>
							<AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
							<div>
								<p className="font-extrabold">Lưu ý về trạng thái xác minh</p>
								<p className="mt-0.5 text-amber-800 leading-relaxed">
									Thay đổi mức độ thành thạo hoặc số lần dẫn đoàn sẽ hủy xác minh hiện tại. Bạn sẽ
									cần được Host sở hữu tuyến hoặc Admin xác minh lại.
								</p>
							</div>
						</div>
					)}

					{/* Route Selection */}
					<div className="flex flex-col gap-2">
						<label
							htmlFor="routeId"
							className="text-xs font-extrabold uppercase tracking-wider text-[#4a5e51]"
						>
							Tuyến trekking *
						</label>
						{isEditMode ? (
							<div className="rounded-xl border border-[#d2ded2] bg-[#f4f7f2] px-3.5 py-2.5 text-sm font-bold text-[#10221b]">
								{availableRoutes.find((r) => r.id === qualification?.routeId)?.name ||
									qualification?.routeId}
							</div>
						) : (
							<>
								<input
									id="routeId"
									data-testid="route-id-input"
									type="text"
									placeholder="Nhập mã Tuyến (UUID), ví dụ: 400dc5c4-8e81-497f-92a0-6fe3249ef922..."
									list="route-suggestions"
									disabled={isSubmitting}
									{...register("routeId")}
									className="w-full rounded-xl border border-[#d2ded2] bg-white px-3.5 py-2.5 text-sm font-medium text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-1 focus:ring-[#164027]"
								/>
								<datalist id="route-suggestions">
									{filteredRoutes.map((route) => (
										<option key={route.id} value={route.id}>
											{route.name}
										</option>
									))}
								</datalist>
							</>
						)}
						{errors.routeId && (
							<p className="text-xs font-bold text-red-600">{errors.routeId.message}</p>
						)}
					</div>

					{/* Proficiency Selection */}
					<div className="flex flex-col gap-2">
						<label className="text-xs font-extrabold uppercase tracking-wider text-[#4a5e51]">
							Mức độ thành thạo *
						</label>
						<div className="flex flex-col gap-2">
							{(["learning", "proficient", "expert"] as PorterRouteProficiency[]).map((level) => {
								const isSelected = selectedProficiency === level;
								return (
									<button
										key={level}
										type="button"
										disabled={isSubmitting}
										onClick={() =>
											setValue("proficiency", level, {
												shouldDirty: true,
												shouldValidate: true,
											})
										}
										className={`flex items-start justify-between rounded-2xl border p-3.5 text-left transition ${
											isSelected
												? "border-[#164027] bg-[#eef7f0] text-[#164027] ring-1 ring-[#164027]"
												: "border-[#d2ded2] bg-white text-[#4a5e51] hover:bg-[#f8faf7]"
										}`}
									>
										<div className="pr-3">
											<p className="text-xs font-extrabold">{PROFICIENCY_LABELS[level]}</p>
											<p className="mt-0.5 text-[11px] text-[#627769]">
												{PROFICIENCY_DESCRIPTIONS[level]}
											</p>
										</div>
										{isSelected && <Check size={16} className="shrink-0 text-[#164027] mt-0.5" />}
									</button>
								);
							})}
						</div>
						{errors.proficiency && (
							<p className="text-xs font-bold text-red-600">{errors.proficiency.message}</p>
						)}
					</div>

					{/* Times Led */}
					<div className="flex flex-col gap-2">
						<label
							htmlFor="timesLed"
							className="text-xs font-extrabold uppercase tracking-wider text-[#4a5e51]"
						>
							Số lần đã dẫn / hỗ trợ đoàn trên tuyến *
						</label>
						<div className="max-w-xs">
							<input
								id="timesLed"
								type="number"
								min={0}
								step={1}
								disabled={isSubmitting}
								{...register("timesLed", { valueAsNumber: true })}
								className="w-full rounded-xl border border-[#d2ded2] bg-white px-3.5 py-2.5 text-sm font-medium text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-1 focus:ring-[#164027] disabled:bg-[#f4f7f2]"
							/>
						</div>
						{errors.timesLed && (
							<p data-testid="timesLed-error" className="text-xs font-bold text-red-600">
								{errors.timesLed.message}
							</p>
						)}
					</div>

					{/* Actions */}
					<div className="mt-4 flex items-center justify-end gap-3 border-t border-[#e7eee7] pt-4">
						<button
							type="button"
							onClick={onClose}
							disabled={isSubmitting}
							className="rounded-xl border border-[#d2ded2] px-4 py-2.5 text-xs font-bold text-[#55685a] hover:bg-[#f4f7f2]"
						>
							Hủy bỏ
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							data-testid="submit-qualification-button"
							className="flex items-center gap-2 rounded-xl bg-[#164027] px-6 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#205234] disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isSubmitting ? (
								<>
									<Loader2 size={16} className="animate-spin" />
									<span>Đang lưu...</span>
								</>
							) : (
								<span>{isEditMode ? "Lưu cập nhật" : "Thêm chứng chỉ"}</span>
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
