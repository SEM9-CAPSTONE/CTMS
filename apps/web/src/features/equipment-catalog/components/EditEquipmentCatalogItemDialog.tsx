import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, PackageCheck, X } from "lucide-react";
import { useLayoutEffect } from "react";
import { useForm } from "react-hook-form";
import {
	type UpdateEquipmentCatalogItemFormValues,
	toUpdateEquipmentCatalogItemInput,
	updateEquipmentCatalogItemSchema,
} from "../schema/update-equipment-catalog-item.schema";
import type { EquipmentCatalogItem, UpdateEquipmentCatalogItemInput } from "../types";

export interface EditEquipmentCatalogItemDialogProps {
	open: boolean;
	item: EquipmentCatalogItem | null;
	isSubmitting: boolean;
	errorMessage: string | null;
	onClose: () => void;
	onConfirm: (payload: UpdateEquipmentCatalogItemInput) => Promise<void>;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2 text-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-[#f4f7f2] disabled:text-[#7b8c82]";

function toFormValues(item: EquipmentCatalogItem): UpdateEquipmentCatalogItemFormValues {
	return {
		name: item.name,
		category: item.category,
		quantityTotal: item.quantityTotal,
		rentalPricePerDay: item.rentalPricePerDay,
		status: item.status,
		maintenanceSchedule: item.maintenanceSchedule ?? "",
	};
}

export function EditEquipmentCatalogItemDialog(props: EditEquipmentCatalogItemDialogProps) {
	const form = useForm<UpdateEquipmentCatalogItemFormValues>({
		resolver: zodResolver(updateEquipmentCatalogItemSchema),
		defaultValues: props.item
			? toFormValues(props.item)
			: {
					name: "",
					category: "",
					quantityTotal: 0,
					rentalPricePerDay: 0,
					status: "active",
					maintenanceSchedule: "",
				},
	});

	// useLayoutEffect (not useEffect): the reset must be committed before the
	// dialog paints, otherwise a fast typed value can be overwritten by this
	// reset landing a tick later (observed as a real bug via a fast E2E fill
	// right after the dialog opened).
	useLayoutEffect(() => {
		if (props.open && props.item) form.reset(toFormValues(props.item));
	}, [props.open, props.item, form]);

	if (!props.open || !props.item) return null;

	const submit = form.handleSubmit((values) =>
		props.onConfirm(toUpdateEquipmentCatalogItemInput(values))
	);

	return (
		<div
			aria-modal="true"
			className="fixed inset-0 z-[60] flex items-center justify-center bg-[#10221b]/50 p-4"
			aria-labelledby="edit-equipment-catalog-item-title"
		>
			<div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
				<div className="flex items-center justify-between border-b border-[#e0ebe0] px-5 py-4">
					<h2
						id="edit-equipment-catalog-item-title"
						className="text-lg font-extrabold text-[#10221b]"
					>
						Sửa thiết bị
					</h2>
					<button
						type="button"
						onClick={props.onClose}
						disabled={props.isSubmitting}
						aria-label="Đóng chỉnh sửa"
						className="rounded-lg p-2 text-[#667a6d] hover:bg-[#f4f7f2]"
					>
						<X className="size-5" />
					</button>
				</div>
				<form onSubmit={submit} className="space-y-4 p-5">
					<div className="grid gap-4 sm:grid-cols-2">
						<label className="text-sm font-bold text-[#34483b]">
							Tên thiết bị
							<input
								aria-label="Tên thiết bị"
								disabled={props.isSubmitting}
								maxLength={150}
								className={inputClass}
								{...form.register("name")}
							/>
							{form.formState.errors.name && (
								<span className="mt-1 block text-xs text-red-600">
									{form.formState.errors.name.message}
								</span>
							)}
						</label>
						<label className="text-sm font-bold text-[#34483b]">
							Loại thiết bị
							<input
								aria-label="Loại thiết bị"
								disabled={props.isSubmitting}
								maxLength={100}
								className={inputClass}
								{...form.register("category")}
							/>
							{form.formState.errors.category && (
								<span className="mt-1 block text-xs text-red-600">
									{form.formState.errors.category.message}
								</span>
							)}
						</label>
						<label className="text-sm font-bold text-[#34483b]">
							Số lượng
							<input
								type="number"
								aria-label="Số lượng"
								disabled={props.isSubmitting}
								className={inputClass}
								{...form.register("quantityTotal", { valueAsNumber: true })}
							/>
							{form.formState.errors.quantityTotal && (
								<span className="mt-1 block text-xs text-red-600">
									{form.formState.errors.quantityTotal.message}
								</span>
							)}
						</label>
						<label className="text-sm font-bold text-[#34483b]">
							Giá thuê mỗi ngày (VND)
							<input
								type="number"
								aria-label="Giá thuê mỗi ngày"
								disabled={props.isSubmitting}
								className={inputClass}
								{...form.register("rentalPricePerDay", { valueAsNumber: true })}
							/>
							{form.formState.errors.rentalPricePerDay && (
								<span className="mt-1 block text-xs text-red-600">
									{form.formState.errors.rentalPricePerDay.message}
								</span>
							)}
						</label>
						<label className="text-sm font-bold text-[#34483b]">
							Trạng thái
							<select
								aria-label="Trạng thái"
								disabled={props.isSubmitting}
								className={inputClass}
								{...form.register("status")}
							>
								<option value="active">Đang hoạt động</option>
								<option value="inactive">Ngừng hoạt động</option>
								<option value="retired">Đã ngừng sử dụng</option>
							</select>
						</label>
						<label className="text-sm font-bold text-[#34483b] sm:col-span-2">
							Lịch bảo trì (không bắt buộc)
							<textarea
								aria-label="Lịch bảo trì"
								disabled={props.isSubmitting}
								maxLength={500}
								rows={3}
								className={inputClass}
								{...form.register("maintenanceSchedule")}
							/>
							{form.formState.errors.maintenanceSchedule && (
								<span className="mt-1 block text-xs text-red-600">
									{form.formState.errors.maintenanceSchedule.message}
								</span>
							)}
						</label>
					</div>
					{props.errorMessage && (
						<div
							role="alert"
							className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
						>
							<AlertCircle className="mt-0.5 size-4 shrink-0" />
							{props.errorMessage}
						</div>
					)}
					<div className="flex justify-end gap-3">
						<button
							type="button"
							onClick={props.onClose}
							disabled={props.isSubmitting}
							className="rounded-xl border border-[#dfe8df] px-4 py-2 text-sm font-bold text-[#425048] disabled:opacity-50"
						>
							Hủy
						</button>
						<button
							type="submit"
							disabled={props.isSubmitting}
							className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-4 py-2 text-sm font-bold text-white disabled:opacity-50 hover:bg-[#276143]"
						>
							{props.isSubmitting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<PackageCheck className="size-4" />
							)}
							{props.isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
