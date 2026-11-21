import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "../../../shared/components";
import { SelectField } from "../../../shared/components/SelectField";
import { HAZARD_SEVERITY_OPTIONS } from "../constants";
import {
	type HotspotDetailsFormValues,
	hotspotDetailsSchema,
} from "../schema/hotspot-details.schema";
import type { SafetyHotspot, UpdateHotspotPayload } from "../types";

interface Props {
	hotspot: SafetyHotspot;
	submitting: boolean;
	onSave: (payload: UpdateHotspotPayload) => Promise<boolean>;
}

const fieldClass =
	"w-full rounded-xl border border-[#dfe8df] bg-white p-3 text-sm text-[#10221b] transition-colors duration-150 focus:border-[#164027] focus:outline-none disabled:opacity-60";
const labelClass = "text-xs font-medium tracking-wide text-[#667a6d]";

function FieldError({ message }: { message?: string }) {
	if (!message) return null;
	return (
		<p role="alert" className="text-xs text-rose-700">
			{message}
		</p>
	);
}

/** Name, description and severity the Admin keeps for a hotspot; position and evidence stay as detected. */
export function HotspotDetailsForm({ hotspot, submitting, onSave }: Props) {
	const {
		register,
		control,
		handleSubmit,
		reset,
		formState: { errors, isDirty },
	} = useForm<HotspotDetailsFormValues>({
		resolver: zodResolver(hotspotDetailsSchema),
		defaultValues: {
			name: hotspot.name ?? "",
			description: hotspot.description ?? "",
			severity: hotspot.severity ?? "medium",
		},
	});

	const save = handleSubmit(async (values) => {
		if (await onSave(values)) reset(values);
	});

	return (
		<form className="space-y-4" onSubmit={save}>
			<div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
				<div className="space-y-1.5">
					<label htmlFor="hotspot-name" className={labelClass}>
						Tên điểm nóng
					</label>
					<input
						id="hotspot-name"
						{...register("name")}
						disabled={submitting}
						className={fieldClass}
					/>
					<FieldError message={errors.name?.message} />
				</div>
				<Controller
					control={control}
					name="severity"
					render={({ field }) => (
						<div className="space-y-1.5">
							<span aria-hidden="true" className={labelClass}>
								Mức độ
							</span>
							<SelectField
								label="Mức độ"
								value={field.value}
								options={HAZARD_SEVERITY_OPTIONS}
								onChange={(value) => field.onChange(value)}
								disabled={submitting}
							/>
						</div>
					)}
				/>
			</div>
			<div className="space-y-1.5">
				<label htmlFor="hotspot-description" className={labelClass}>
					Mô tả
				</label>
				<textarea
					id="hotspot-description"
					rows={3}
					{...register("description")}
					disabled={submitting}
					className={fieldClass}
				/>
				<FieldError message={errors.description?.message} />
			</div>
			<div className="flex justify-end">
				<Button type="submit" disabled={submitting || !isDirty}>
					Lưu thay đổi
				</Button>
			</div>
		</form>
	);
}
