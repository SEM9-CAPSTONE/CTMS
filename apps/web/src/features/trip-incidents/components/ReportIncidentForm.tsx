import { zodResolver } from "@hookform/resolvers/zod";
import { Crosshair, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../../../shared/components/Button";
import { INCIDENT_PHOTO_TYPES, incidentCategoryLabels, incidentSeverityLabels } from "../constants";
import { useCurrentLocation } from "../hooks/useCurrentLocation";
import {
	type ReportIncidentFormValues,
	reportIncidentSchema,
	toLocalDateTimeInput,
} from "../schema/report-incident.schema";
import { INCIDENT_CATEGORIES, INCIDENT_SEVERITIES } from "../types";
import type { NewIncidentInput } from "../utils/incident-record";

export interface ReportIncidentFormProps {
	isOnline: boolean;
	onSubmit: (input: NewIncidentInput) => Promise<void>;
	onCancel: () => void;
}

const fieldClass =
	"mt-1 w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm text-[#10221b] focus:border-[#2d5a27] focus:outline-none";
const labelClass = "block text-xs font-bold text-[#55685a]";
const errorClass = "mt-1 text-xs font-semibold text-rose-700";

export function ReportIncidentForm({ isOnline, onSubmit, onCancel }: ReportIncidentFormProps) {
	const [saveError, setSaveError] = useState<string | null>(null);
	const { location, state: locationState, locate } = useCurrentLocation();
	const {
		register,
		handleSubmit,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<ReportIncidentFormValues>({
		resolver: zodResolver(reportIncidentSchema),
		defaultValues: {
			category: "injury",
			severity: "medium",
			description: "",
			occurredAt: toLocalDateTimeInput(new Date()),
			photo: null,
		},
	});

	useEffect(() => {
		locate();
	}, [locate]);

	const submit = handleSubmit(async (values) => {
		setSaveError(null);
		try {
			await onSubmit({
				category: values.category,
				severity: values.severity,
				description: values.description,
				occurredAt: new Date(values.occurredAt).toISOString(),
				location,
				photo: values.photo,
			});
		} catch {
			setSaveError("Chưa lưu được sự cố trên thiết bị. Vui lòng kiểm tra bộ nhớ và thử lại.");
		}
	});

	return (
		<form
			aria-label="Báo cáo sự cố"
			onSubmit={submit}
			className="space-y-4 rounded-2xl border border-[#dfe8df] bg-white p-4"
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClass}>
					Loại sự cố
					<select className={fieldClass} {...register("category")}>
						{INCIDENT_CATEGORIES.map((category) => (
							<option key={category} value={category}>
								{incidentCategoryLabels[category]}
							</option>
						))}
					</select>
				</label>
				<label className={labelClass}>
					Mức độ
					<select className={fieldClass} {...register("severity")}>
						{INCIDENT_SEVERITIES.map((severity) => (
							<option key={severity} value={severity}>
								{incidentSeverityLabels[severity]}
							</option>
						))}
					</select>
				</label>
			</div>
			<label className={labelClass}>
				Mô tả
				<textarea rows={3} className={fieldClass} {...register("description")} />
				{errors.description && <p className={errorClass}>{errors.description.message}</p>}
			</label>
			<label className={labelClass}>
				Thời điểm xảy ra
				<input type="datetime-local" className={fieldClass} {...register("occurredAt")} />
				{errors.occurredAt && <p className={errorClass}>{errors.occurredAt.message}</p>}
			</label>
			<LocationField state={locationState} location={location} onLocate={locate} />
			<label className={labelClass}>
				Ảnh (không bắt buộc)
				<input
					type="file"
					accept={INCIDENT_PHOTO_TYPES.join(",")}
					className={fieldClass}
					onChange={(event) =>
						setValue("photo", event.target.files?.[0] ?? null, { shouldValidate: true })
					}
				/>
				{errors.photo && <p className={errorClass}>{errors.photo.message}</p>}
			</label>
			{!isOnline && (
				<p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
					Đang ngoại tuyến: sự cố sẽ được lưu trên thiết bị và tự gửi khi có kết nối.
				</p>
			)}
			<div className="flex justify-end gap-2">
				{saveError && (
					<p role="alert" className={errorClass}>
						{saveError}
					</p>
				)}
				<Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
					Hủy
				</Button>
				<Button type="submit" disabled={isSubmitting || locationState === "locating"}>
					{isOnline ? "Gửi báo cáo" : "Lưu trên thiết bị"}
				</Button>
			</div>
		</form>
	);
}

interface LocationFieldProps {
	state: ReturnType<typeof useCurrentLocation>["state"];
	location: ReturnType<typeof useCurrentLocation>["location"];
	onLocate: () => void;
}

function LocationField({ state, location, onLocate }: LocationFieldProps) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f8f5] p-3 text-xs">
			<div>
				<p className="font-bold text-[#55685a]">Vị trí</p>
				{state === "locating" && (
					<p className="mt-1 flex items-center gap-1 text-[#667a6d]">
						<Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
						<span>Đang lấy vị trí...</span>
					</p>
				)}
				{state === "located" && location && (
					<p className="mt-1 text-[#10221b]">
						{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} (±
						{Math.round(location.accuracyMeters)} m)
					</p>
				)}
				{state === "unavailable" && (
					<p className="mt-1 text-amber-900">
						Không lấy được vị trí. Sự cố sẽ được gửi không kèm tọa độ.
					</p>
				)}
			</div>
			<Button size="sm" variant="outline" onClick={onLocate} disabled={state === "locating"}>
				<Crosshair aria-hidden="true" className="mr-1 size-3.5" />
				<span>Lấy lại vị trí</span>
			</Button>
		</div>
	);
}
