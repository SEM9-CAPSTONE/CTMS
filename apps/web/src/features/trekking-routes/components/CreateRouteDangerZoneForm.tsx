import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	type CreateRouteDangerZoneFormValues,
	createRouteDangerZoneFormSchema,
	routeDangerZoneDefaultValues,
	toCreateRouteDangerZoneInput,
} from "../schema/create-route-danger-zone.schema";
import type {
	CreateRouteDangerZoneInput,
	RouteDangerZone,
	RouteDangerZoneGeometry,
	RouteMapMode,
} from "../types";

interface Props {
	mode: RouteMapMode;
	geometry?: RouteDangerZoneGeometry;
	polygonVertexCount: number;
	disabled: boolean;
	isSubmitting: boolean;
	error: string;
	polygonError: string;
	onModeChange: (mode: RouteMapMode) => void;
	onFinishPolygon: () => void;
	onUndoPolygon: () => void;
	onClearGeometry: () => void;
	onCancel: () => void;
	onRadiusChange: (radius: number) => void;
	onSubmit: (input: CreateRouteDangerZoneInput) => Promise<RouteDangerZone | null>;
	onCreated: () => void;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-sm disabled:bg-slate-100";

export function CreateRouteDangerZoneForm({
	mode,
	geometry,
	polygonVertexCount,
	disabled,
	isSubmitting,
	error,
	polygonError,
	onModeChange,
	onFinishPolygon,
	onUndoPolygon,
	onClearGeometry,
	onCancel,
	onRadiusChange,
	onSubmit,
	onCreated,
}: Props) {
	const {
		register,
		handleSubmit,
		setValue,
		reset,
		formState: { errors },
	} = useForm<CreateRouteDangerZoneFormValues>({
		resolver: zodResolver(createRouteDangerZoneFormSchema),
		defaultValues: routeDangerZoneDefaultValues,
	});

	useEffect(() => {
		setValue("geometry", geometry, { shouldValidate: Boolean(geometry) });
	}, [geometry, setValue]);

	useEffect(() => {
		const radius = mode === "hazard-polygon" ? "" : "30";
		setValue("radiusMeters", radius, { shouldValidate: false });
		onRadiusChange(Number(radius) || 0);
	}, [mode, onRadiusChange, setValue]);

	const fieldDisabled = disabled || isSubmitting;
	const hazardMode = mode !== "checkpoint";

	return (
		<section className="mt-6 border-t border-[#e0ebe0] pt-5" aria-labelledby="hazard-create-title">
			<h3 id="hazard-create-title" className="font-extrabold">
				Thêm khu vực nguy hiểm
			</h3>
			<p className="mt-1 text-sm text-[#667a6d]">
				Chọn chế độ bản đồ. Điểm cần bán kính; đa giác cần ít nhất ba đỉnh khác nhau.
			</p>
			<div className="mt-3 flex flex-wrap gap-2" aria-label="Chế độ bản đồ">
				<button
					type="button"
					aria-pressed={mode === "checkpoint"}
					disabled={fieldDisabled}
					onClick={() => onModeChange("checkpoint")}
					className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"
				>
					Checkpoint / nơi trú ẩn
				</button>
				<button
					type="button"
					aria-pressed={mode === "hazard-point"}
					disabled={fieldDisabled}
					onClick={() => onModeChange("hazard-point")}
					className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"
				>
					Điểm nguy hiểm
				</button>
				<button
					type="button"
					aria-pressed={mode === "hazard-polygon"}
					disabled={fieldDisabled}
					onClick={() => onModeChange("hazard-polygon")}
					className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"
				>
					Đa giác nguy hiểm
				</button>
			</div>

			{mode === "hazard-polygon" && (
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<span className="text-sm font-bold">{polygonVertexCount} đỉnh đã chọn</span>
					<button
						type="button"
						disabled={fieldDisabled || polygonVertexCount < 3}
						onClick={onFinishPolygon}
						className="rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
					>
						Hoàn tất đa giác
					</button>
					<button
						type="button"
						disabled={fieldDisabled || polygonVertexCount === 0}
						onClick={onUndoPolygon}
						className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"
					>
						<Undo2 className="mr-1 inline size-4" />
						Hoàn tác đỉnh
					</button>
					<button
						type="button"
						disabled={fieldDisabled || polygonVertexCount === 0}
						onClick={onClearGeometry}
						className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"
					>
						<Trash2 className="mr-1 inline size-4" />
						Xóa đa giác
					</button>
					{polygonError && (
						<span role="alert" className="text-sm text-red-700">
							{polygonError}
						</span>
					)}
				</div>
			)}

			{hazardMode && (
				<form
					className="mt-4 grid gap-4 sm:grid-cols-2"
					onSubmit={handleSubmit(async (values) => {
						const created = await onSubmit(toCreateRouteDangerZoneInput(values));
						if (created) {
							reset(routeDangerZoneDefaultValues);
							onRadiusChange(30);
							onCreated();
						}
					})}
				>
					{mode === "hazard-point" && (
						<label className="text-sm font-bold">
							Bán kính vùng nguy hiểm (mét)
							<input
								aria-label="Bán kính vùng nguy hiểm (mét)"
								inputMode="decimal"
								disabled={fieldDisabled}
								className={inputClass}
								{...register("radiusMeters", {
									onChange: (event) => onRadiusChange(Number(event.target.value) || 0),
								})}
							/>
							{errors.radiusMeters && (
								<span className="mt-1 block text-xs text-red-600">
									{errors.radiusMeters.message}
								</span>
							)}
						</label>
					)}
					<label className="text-sm font-bold">
						Mức độ nguy hiểm
						<select
							aria-label="Mức độ nguy hiểm"
							disabled={fieldDisabled}
							className={inputClass}
							{...register("severity")}
						>
							<option value="low">Thấp</option>
							<option value="medium">Trung bình</option>
							<option value="high">Cao</option>
						</select>
					</label>
					<label className="text-sm font-bold sm:col-span-2">
						Mô tả an toàn
						<textarea
							aria-label="Mô tả an toàn"
							maxLength={1000}
							rows={3}
							disabled={fieldDisabled}
							className={inputClass}
							{...register("description")}
						/>
						{errors.description && (
							<span className="mt-1 block text-xs text-red-600">{errors.description.message}</span>
						)}
					</label>
					{errors.geometry && (
						<p role="alert" className="text-sm text-red-600 sm:col-span-2">
							{errors.geometry.message}
						</p>
					)}
					{error && (
						<p
							role="alert"
							className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2"
						>
							<AlertCircle className="size-5 shrink-0" />
							{error}
						</p>
					)}
					<div className="flex flex-wrap gap-2 sm:col-span-2">
						<button
							type="submit"
							disabled={fieldDisabled}
							className="flex items-center gap-2 rounded-xl bg-[#8f2f16] px-5 py-3 font-bold text-white disabled:opacity-50"
						>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Đang tạo khu vực nguy hiểm..." : "Tạo khu vực nguy hiểm"}
						</button>
						<button
							type="button"
							disabled={fieldDisabled}
							onClick={() => {
								reset(routeDangerZoneDefaultValues);
								onRadiusChange(30);
								onCancel();
							}}
							className="rounded-xl border px-5 py-3 font-bold disabled:opacity-50"
						>
							<RotateCcw className="mr-1 inline size-4" />
							Hủy
						</button>
					</div>
				</form>
			)}
		</section>
	);
}
