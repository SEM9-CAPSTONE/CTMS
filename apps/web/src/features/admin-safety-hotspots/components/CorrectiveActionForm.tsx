import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button, ConfirmModal } from "../../../shared/components";
import { SelectField } from "../../../shared/components/SelectField";
import {
	CORRECTIVE_ACTION_LABELS,
	CORRECTIVE_ACTION_OPTIONS,
	HAZARD_SEVERITY_OPTIONS,
} from "../constants";
import {
	type CorrectiveActionFormData,
	type CorrectiveActionFormInput,
	correctiveActionSchema,
} from "../schema/corrective-action.schema";
import type { CorrectiveTargets, CreateCorrectiveActionPayload, SafetyHotspot } from "../types";

interface Props {
	hotspot: SafetyHotspot;
	targets: CorrectiveTargets;
	submitting: boolean;
	onSubmit: (payload: CreateCorrectiveActionPayload) => Promise<boolean>;
}

const DEFAULT_VALUES: CorrectiveActionFormInput = {
	actionType: "UPDATE_CHECKPOINT_INSTRUCTIONS",
	reason: "",
	checkpointId: "",
	instructions: "",
	hazardAreaId: "",
	hazardDescription: "",
	hazardSeverity: "high",
	hazardRadius: 50,
};

const fieldClass =
	"w-full rounded-xl border border-[#dfe8df] bg-white p-3 text-sm text-[#10221b] transition-colors duration-150 focus:border-[#164027] focus:outline-none disabled:opacity-60";
const labelClass = "text-xs font-medium tracking-wide text-[#667a6d]";

/** SelectField only carries an aria-label; this shows the same caption visually. */
function LabeledSelect({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="space-y-1.5">
			<span aria-hidden="true" className={labelClass}>
				{label}
			</span>
			{children}
		</div>
	);
}

function FieldError({ message }: { message?: string }) {
	if (!message) return null;
	return (
		<p role="alert" className="text-xs text-rose-700">
			{message}
		</p>
	);
}

export function CorrectiveActionForm({ hotspot, targets, submitting, onSubmit }: Props) {
	const [pending, setPending] = useState<CreateCorrectiveActionPayload | null>(null);
	const {
		control,
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors },
	} = useForm<CorrectiveActionFormInput, unknown, CorrectiveActionFormData>({
		resolver: zodResolver(correctiveActionSchema),
		defaultValues: DEFAULT_VALUES,
	});
	const actionType = watch("actionType");
	const isCheckpointAction = actionType === "UPDATE_CHECKPOINT_INSTRUCTIONS";
	const isHazardAction = actionType === "ADD_HAZARD_AREA" || actionType === "UPDATE_HAZARD_AREA";
	const isHazardUpdate = actionType === "UPDATE_HAZARD_AREA";
	const pointHazards = targets.hazardAreas.filter((zone) => zone.geometry.type === "Point");

	const checkpointOptions = [
		{ value: "", label: "Chọn điểm dừng" },
		...targets.checkpoints.map((checkpoint, index) => ({
			value: checkpoint.id,
			label: `${index + 1}. ${checkpoint.name}`,
		})),
	];
	const hazardOptions = [
		{ value: "", label: "Chọn vùng nguy hiểm" },
		...pointHazards.map((zone) => ({ value: zone.id, label: zone.description })),
	];

	const pickCheckpoint = (id: string) => {
		setValue("checkpointId", id, { shouldValidate: true });
		const checkpoint = targets.checkpoints.find((item) => item.id === id);
		setValue("instructions", checkpoint?.instructions ?? "");
	};
	const pickHazard = (id: string) => {
		setValue("hazardAreaId", id, { shouldValidate: true });
		const zone = pointHazards.find((item) => item.id === id);
		if (!zone) return;
		setValue("hazardDescription", zone.description);
		setValue("hazardSeverity", zone.severity);
		setValue("hazardRadius", zone.radiusMeters ?? 50);
	};

	const toPayload = (values: CorrectiveActionFormData): CreateCorrectiveActionPayload => {
		const base = { actionType: values.actionType, reason: values.reason };
		if (values.actionType === "UPDATE_CHECKPOINT_INSTRUCTIONS") {
			return { ...base, checkpointId: values.checkpointId, instructions: values.instructions };
		}
		if (values.actionType === "ADD_HAZARD_AREA" || values.actionType === "UPDATE_HAZARD_AREA") {
			const zone = pointHazards.find((item) => item.id === values.hazardAreaId);
			const coordinates: [number, number] =
				values.actionType === "UPDATE_HAZARD_AREA" && zone?.geometry.type === "Point"
					? zone.geometry.coordinates
					: [hotspot.centerLng, hotspot.centerLat];
			return {
				...base,
				...(values.actionType === "UPDATE_HAZARD_AREA"
					? { hazardAreaId: values.hazardAreaId }
					: {}),
				hazardArea: {
					geometry: { type: "Point", coordinates },
					radiusMeters: values.hazardRadius,
					description: values.hazardDescription,
					severity: values.hazardSeverity,
				},
			};
		}
		return base;
	};

	const confirm = async () => {
		if (!pending) return;
		const saved = await onSubmit(pending);
		setPending(null);
		if (saved) reset(DEFAULT_VALUES);
	};

	return (
		<>
			<form
				onSubmit={handleSubmit((values) => setPending(toPayload(values)))}
				className="space-y-4"
				noValidate
			>
				<Controller
					control={control}
					name="actionType"
					render={({ field }) => (
						<LabeledSelect label="Biện pháp">
							<SelectField
								label="Biện pháp"
								value={field.value}
								options={CORRECTIVE_ACTION_OPTIONS}
								onChange={(value) => field.onChange(value)}
								disabled={submitting}
							/>
						</LabeledSelect>
					)}
				/>

				{isCheckpointAction && (
					<div className="space-y-3">
						<Controller
							control={control}
							name="checkpointId"
							render={({ field }) => (
								<LabeledSelect label="Điểm dừng">
									<SelectField
										label="Điểm dừng"
										value={field.value}
										options={checkpointOptions}
										onChange={pickCheckpoint}
										disabled={submitting}
									/>
								</LabeledSelect>
							)}
						/>
						<FieldError message={errors.checkpointId?.message} />
						<div className="space-y-1.5">
							<label htmlFor="hotspot-instructions" className={labelClass}>
								Hướng dẫn an toàn mới
							</label>
							<textarea
								id="hotspot-instructions"
								rows={3}
								{...register("instructions")}
								className={fieldClass}
								disabled={submitting}
							/>
							<FieldError message={errors.instructions?.message} />
						</div>
					</div>
				)}

				{isHazardAction && (
					<div className="space-y-3">
						{isHazardUpdate && (
							<>
								<Controller
									control={control}
									name="hazardAreaId"
									render={({ field }) => (
										<LabeledSelect label="Vùng nguy hiểm">
											<SelectField
												label="Vùng nguy hiểm"
												value={field.value}
												options={hazardOptions}
												onChange={pickHazard}
												disabled={submitting || pointHazards.length === 0}
											/>
										</LabeledSelect>
									)}
								/>
								<FieldError message={errors.hazardAreaId?.message} />
							</>
						)}
						{!isHazardUpdate && (
							<p className="text-xs text-[#667a6d]/80">
								Vùng nguy hiểm được đặt tại tâm điểm nóng ({hotspot.centerLat.toFixed(5)},{" "}
								{hotspot.centerLng.toFixed(5)}).
							</p>
						)}
						<div className="space-y-1.5">
							<label htmlFor="hotspot-hazard-description" className={labelClass}>
								Mô tả vùng nguy hiểm
							</label>
							<textarea
								id="hotspot-hazard-description"
								rows={2}
								{...register("hazardDescription")}
								className={fieldClass}
								disabled={submitting}
							/>
							<FieldError message={errors.hazardDescription?.message} />
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<Controller
								control={control}
								name="hazardSeverity"
								render={({ field }) => (
									<LabeledSelect label="Mức độ">
										<SelectField
											label="Mức độ"
											value={field.value}
											options={HAZARD_SEVERITY_OPTIONS}
											onChange={(value) => field.onChange(value)}
											disabled={submitting}
										/>
									</LabeledSelect>
								)}
							/>
							<div className="space-y-1.5">
								<label htmlFor="hotspot-hazard-radius" className={labelClass}>
									Bán kính (m)
								</label>
								<input
									id="hotspot-hazard-radius"
									type="number"
									min={1}
									{...register("hazardRadius")}
									className={fieldClass}
									disabled={submitting}
								/>
								<FieldError message={errors.hazardRadius?.message} />
							</div>
						</div>
					</div>
				)}

				<div className="space-y-1.5">
					<label htmlFor="hotspot-reason" className={labelClass}>
						Lý do
					</label>
					<textarea
						id="hotspot-reason"
						rows={3}
						{...register("reason")}
						className={fieldClass}
						disabled={submitting}
					/>
					<FieldError message={errors.reason?.message} />
				</div>

				<div className="flex justify-end">
					<Button type="submit" disabled={submitting}>
						Cập nhật dữ liệu an toàn
					</Button>
				</div>
			</form>

			<ConfirmModal
				isOpen={pending !== null}
				onClose={() => setPending(null)}
				onConfirm={confirm}
				isLoading={submitting}
				variant="warning"
				title="Xác nhận cập nhật dữ liệu an toàn"
				description={
					pending
						? `${CORRECTIVE_ACTION_LABELS[pending.actionType]} trên tuyến ${hotspot.routeName}. Thay đổi được ghi vào lịch sử và không thể hoàn tác.`
						: ""
				}
				confirmText="Cập nhật"
				cancelText="Quay lại"
			/>
		</>
	);
}
