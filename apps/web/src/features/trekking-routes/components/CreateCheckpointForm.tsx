import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	type CreateCheckpointFormValues,
	checkpointDefaultValues,
	createCheckpointFormSchema,
	toCreateCheckpointInput,
} from "../schema/create-checkpoint.schema";
import type { CreateCheckpointInput, GeoJsonPoint, RouteCheckpoint } from "../types";

interface Props {
	location?: GeoJsonPoint;
	expectedDurationMinutes: number;
	disabled: boolean;
	isSubmitting: boolean;
	error: string;
	onRadiusChange: (radius: number) => void;
	onSubmit: (input: CreateCheckpointInput) => Promise<RouteCheckpoint | null>;
	onCreated: () => void;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-sm disabled:bg-slate-100";

export function CreateCheckpointForm({
	location,
	expectedDurationMinutes,
	disabled,
	isSubmitting,
	error,
	onRadiusChange,
	onSubmit,
	onCreated,
}: Props) {
	const {
		register,
		handleSubmit,
		setValue,
		setError,
		reset,
		formState: { errors },
	} = useForm<CreateCheckpointFormValues>({
		resolver: zodResolver(createCheckpointFormSchema),
		defaultValues: checkpointDefaultValues({ type: "Point", coordinates: [0, 0] }),
	});

	useEffect(() => {
		if (location) setValue("location", location, { shouldValidate: true });
	}, [location, setValue]);

	const fieldDisabled = disabled || isSubmitting;

	return (
		<form
			className="mt-5 grid gap-4 sm:grid-cols-2"
			onSubmit={handleSubmit(async (values) => {
				if (!location) {
					setError("location", { message: "Vui lòng chọn vị trí trên bản đồ" });
					return;
				}
				if (Number(values.expectedArrivalOffset) > expectedDurationMinutes) {
					setError("expectedArrivalOffset", {
						message: `Thời gian đến không được vượt quá ${expectedDurationMinutes} phút`,
					});
					return;
				}
				const created = await onSubmit(toCreateCheckpointInput({ ...values, location }));
				if (created) {
					reset(checkpointDefaultValues({ type: "Point", coordinates: [0, 0] }));
					onRadiusChange(30);
					onCreated();
				}
			})}
		>
			<label className="text-sm font-bold">
				Tên checkpoint
				<input
					aria-label="Tên checkpoint"
					maxLength={150}
					disabled={fieldDisabled}
					className={inputClass}
					{...register("name")}
				/>
				{errors.name && (
					<span className="mt-1 block text-xs text-red-600">{errors.name.message}</span>
				)}
			</label>
			<label className="text-sm font-bold">
				Loại checkpoint
				<select
					aria-label="Loại checkpoint"
					disabled={fieldDisabled}
					className={inputClass}
					{...register("type")}
				>
					<option value="start">Bắt đầu</option>
					<option value="rest">Nghỉ chân</option>
					<option value="water">Nguồn nước</option>
					<option value="dangerous">Nguy hiểm</option>
					<option value="emergency_shelter">Nơi trú ẩn khẩn cấp</option>
					<option value="finish">Kết thúc</option>
				</select>
			</label>
			<label className="text-sm font-bold">
				Bán kính (mét)
				<input
					aria-label="Bán kính (mét)"
					inputMode="numeric"
					disabled={fieldDisabled}
					className={inputClass}
					{...register("radiusMeters", {
						onChange: (event) => onRadiusChange(Number(event.target.value) || 0),
					})}
				/>
				{errors.radiusMeters && (
					<span className="mt-1 block text-xs text-red-600">{errors.radiusMeters.message}</span>
				)}
			</label>
			<label className="text-sm font-bold">
				Thời gian đến dự kiến (phút)
				<input
					aria-label="Thời gian đến dự kiến (phút)"
					inputMode="numeric"
					disabled={fieldDisabled}
					className={inputClass}
					{...register("expectedArrivalOffset")}
				/>
				{errors.expectedArrivalOffset && (
					<span className="mt-1 block text-xs text-red-600">
						{errors.expectedArrivalOffset.message}
					</span>
				)}
			</label>
			<label className="text-sm font-bold sm:col-span-2">
				Hướng dẫn
				<textarea
					aria-label="Hướng dẫn"
					maxLength={1000}
					rows={3}
					disabled={fieldDisabled}
					className={inputClass}
					{...register("instructions")}
				/>
				{errors.instructions && (
					<span className="mt-1 block text-xs text-red-600">{errors.instructions.message}</span>
				)}
			</label>
			<label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
				<input type="checkbox" disabled={fieldDisabled} {...register("nearbyWaterOrShelter")} />
				Có nguồn nước hoặc nơi trú ẩn gần đây
			</label>
			{errors.location && (
				<p role="alert" className="text-sm text-red-600 sm:col-span-2">
					{errors.location.message}
				</p>
			)}
			{error && (
				<p
					role="alert"
					className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2"
				>
					<AlertCircle className="size-5 shrink-0" /> {error}
				</p>
			)}
			<button
				type="submit"
				disabled={fieldDisabled}
				className="flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-5 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2"
			>
				{isSubmitting && <Loader2 className="size-4 animate-spin" />}
				{isSubmitting ? "Đang tạo checkpoint..." : "Tạo checkpoint"}
			</button>
		</form>
	);
}
