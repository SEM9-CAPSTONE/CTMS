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
import type {
	CreateCheckpointInput,
	GeoJsonPoint,
	RouteCheckpoint,
	RouteCheckpointType,
} from "../types";
import { DANGER_AREA_VALUE, LocationTypeOptions } from "./LocationTypeOptions";

interface Props {
	checkpoint?: RouteCheckpoint;
	location?: GeoJsonPoint;
	initialType?: RouteCheckpointType;
	onSelectDangerArea?: () => void;
	disabled: boolean;
	isSubmitting: boolean;
	error: string;
	onSubmit: (input: CreateCheckpointInput) => Promise<RouteCheckpoint | null>;
	onCreated: () => void;
	onCancel?: () => void;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-sm disabled:bg-slate-100";

export function CreateCheckpointForm({
	checkpoint,
	location,
	initialType,
	onSelectDangerArea,
	disabled,
	isSubmitting,
	error,
	onSubmit,
	onCreated,
	onCancel,
}: Props) {
	const defaultsFor = (current?: RouteCheckpoint): CreateCheckpointFormValues => {
		const values = checkpointDefaultValues(
			current?.location ?? { type: "Point", coordinates: [0, 0] },
			current
		);
		return current || !initialType ? values : { ...values, type: initialType };
	};
	const {
		register,
		handleSubmit,
		setValue,
		setError,
		reset,
		formState: { errors },
	} = useForm<CreateCheckpointFormValues>({
		resolver: zodResolver(createCheckpointFormSchema),
		defaultValues: defaultsFor(checkpoint),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the edited checkpoint changes
	useEffect(() => {
		reset(defaultsFor(checkpoint));
	}, [checkpoint, reset]);

	useEffect(() => {
		if (location) setValue("location", location, { shouldValidate: true });
	}, [location, setValue]);

	useEffect(() => {
		if (initialType && !checkpoint) {
			setValue("type", initialType, { shouldValidate: true });
		}
	}, [initialType, checkpoint, setValue]);

	const fieldDisabled = disabled || isSubmitting;

	return (
		<form
			aria-label={checkpoint ? "Sửa vị trí" : "Thêm vị trí"}
			className="mt-5 grid gap-4 sm:grid-cols-2"
			onSubmit={handleSubmit(async (values) => {
				if (!location) {
					setError("location", { message: "Vui lòng chọn vị trí trên bản đồ" });
					return;
				}
				const saved = await onSubmit(toCreateCheckpointInput({ ...values, location }, checkpoint));
				if (saved) {
					if (!checkpoint) reset(defaultsFor());
					onCreated();
				}
			})}
		>
			<label className="text-sm font-bold">
				Vị trí
				<select
					aria-label="Vị trí"
					disabled={fieldDisabled}
					className={inputClass}
					{...register("type", {
						onChange: (event) => {
							if (event.target.value === DANGER_AREA_VALUE) onSelectDangerArea?.();
						},
					})}
				>
					<LocationTypeOptions includeDangerArea={!checkpoint && Boolean(onSelectDangerArea)} />
				</select>
				{errors.type && (
					<span className="mt-1 block text-xs text-red-600">{errors.type.message}</span>
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
			<div className="flex flex-wrap gap-2 sm:col-span-2">
				<button
					type="submit"
					disabled={fieldDisabled}
					className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#164027] px-5 py-3 font-bold text-white disabled:opacity-50"
				>
					{isSubmitting && <Loader2 className="size-4 animate-spin" />}
					{checkpoint
						? isSubmitting
							? "Đang lưu thay đổi..."
							: "Lưu thay đổi"
						: isSubmitting
							? "Đang thêm vị trí..."
							: "Thêm vị trí"}
				</button>
				{checkpoint && (
					<button
						type="button"
						disabled={fieldDisabled}
						onClick={onCancel}
						className="rounded-xl border px-5 py-3 font-bold disabled:opacity-50"
					>
						Hủy
					</button>
				)}
			</div>
		</form>
	);
}
