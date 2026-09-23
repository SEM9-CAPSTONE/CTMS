import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, PackagePlus, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { CreateEquipmentCatalogItemError } from "../hooks/useCreateEquipmentCatalogItem";
import {
	CREATE_EQUIPMENT_CATALOG_ITEM_DEFAULT_VALUES,
	type CreateEquipmentCatalogItemFormValues,
	createEquipmentCatalogItemSchema,
	toCreateEquipmentCatalogItemInput,
} from "../schema/create-equipment-catalog-item.schema";
import type { CreateEquipmentCatalogItemInput } from "../types";

export interface CreateEquipmentCatalogItemFormProps {
	isSubmitting: boolean;
	error: CreateEquipmentCatalogItemError | null;
	onSubmit: (payload: CreateEquipmentCatalogItemInput) => Promise<unknown>;
	onRetry: () => Promise<unknown>;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-[#f4f7f2] disabled:text-[#7b8c82]";

const backendFieldMap: Record<string, keyof CreateEquipmentCatalogItemFormValues> = {
	name: "name",
	category: "category",
	quantityTotal: "quantityTotal",
	rentalPricePerDay: "rentalPricePerDay",
	maintenanceSchedule: "maintenanceSchedule",
};

export function CreateEquipmentCatalogItemForm({
	isSubmitting,
	error,
	onSubmit,
	onRetry,
}: CreateEquipmentCatalogItemFormProps) {
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors },
	} = useForm<CreateEquipmentCatalogItemFormValues>({
		resolver: zodResolver(createEquipmentCatalogItemSchema),
		defaultValues: CREATE_EQUIPMENT_CATALOG_ITEM_DEFAULT_VALUES,
	});

	useEffect(() => {
		if (!error) return;
		for (const [field, message] of Object.entries(error.fieldErrors)) {
			const formField = backendFieldMap[field];
			if (formField) setError(formField, { type: "server", message });
		}
	}, [error, setError]);

	const submit = handleSubmit((values) => onSubmit(toCreateEquipmentCatalogItemInput(values)));

	return (
		<form onSubmit={submit} className="space-y-5">
			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<h2 className="font-extrabold text-[#10221b]">Thông tin thiết bị</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					<label className="text-sm font-bold text-[#34483b]">
						Tên thiết bị
						<input
							aria-label="Tên thiết bị"
							disabled={isSubmitting}
							maxLength={150}
							className={inputClass}
							{...register("name")}
						/>
						{errors.name && (
							<span className="mt-1 block text-xs text-red-600">{errors.name.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Loại thiết bị
						<input
							aria-label="Loại thiết bị"
							disabled={isSubmitting}
							maxLength={100}
							className={inputClass}
							{...register("category")}
						/>
						{errors.category && (
							<span className="mt-1 block text-xs text-red-600">{errors.category.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Số lượng
						<input
							type="number"
							aria-label="Số lượng"
							disabled={isSubmitting}
							className={inputClass}
							{...register("quantityTotal", { valueAsNumber: true })}
						/>
						{errors.quantityTotal && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.quantityTotal.message}
							</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Giá thuê mỗi ngày (VND)
						<input
							type="number"
							aria-label="Giá thuê mỗi ngày"
							disabled={isSubmitting}
							className={inputClass}
							{...register("rentalPricePerDay", { valueAsNumber: true })}
						/>
						{errors.rentalPricePerDay && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.rentalPricePerDay.message}
							</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b] sm:col-span-2">
						Lịch bảo trì (không bắt buộc)
						<textarea
							aria-label="Lịch bảo trì"
							disabled={isSubmitting}
							maxLength={500}
							rows={3}
							className={inputClass}
							{...register("maintenanceSchedule")}
						/>
						{errors.maintenanceSchedule && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.maintenanceSchedule.message}
							</span>
						)}
					</label>
				</div>
			</section>

			{error && (
				<div
					role="alert"
					className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
				>
					<AlertCircle className="mt-0.5 size-5 shrink-0" />
					<div className="flex-1">
						<p className="font-bold">{error.message}</p>
						{error.canRetry && (
							<button
								type="button"
								onClick={() => void onRetry()}
								className="mt-2 inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold"
							>
								<RefreshCw className="size-3.5" />
								Thử lại
							</button>
						)}
					</div>
				</div>
			)}

			<button
				type="submit"
				disabled={isSubmitting}
				className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
			>
				{isSubmitting ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<PackagePlus className="size-4" />
				)}
				{isSubmitting ? "Đang tạo thiết bị..." : "Thêm thiết bị"}
			</button>
		</form>
	);
}
