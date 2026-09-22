import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertCircle,
	CheckCircle2,
	Loader2,
	MapPin,
	Plus,
	RefreshCw,
	Send,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useRouteCheckpoints } from "../../trekking-routes/hooks/useRouteCheckpoints";
import type { RouteCheckpoint } from "../../trekking-routes/types";
import type { ConfigureTripWaypointsError } from "../hooks/useConfigureTripWaypoints";
import { useConfigureTripWaypoints } from "../hooks/useConfigureTripWaypoints";
import {
	type ConfigureTripWaypointsFormValues,
	createConfigureTripWaypointsSchema,
	toConfigureTripWaypointsDefaultValues,
	toConfigureTripWaypointsInput,
} from "../schema/configure-trip-waypoints.schema";
import type { Trip, TripWaypointType } from "../types";

interface Props {
	trip: Trip;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-[#f4f7f2] disabled:text-[#7b8c82]";

const waypointTypeLabels: Record<TripWaypointType, string> = {
	start: "Bắt đầu",
	checkpoint: "Checkpoint",
	rest: "Nghỉ",
	meal: "Ăn uống",
	activity: "Hoạt động",
	overnight: "Qua đêm",
	finish: "Kết thúc",
};

const backendFieldMap: Record<string, "waypoints"> = {
	"waypoints.checkpointId": "waypoints",
	waypoints: "waypoints",
};

function toNewWaypoint(
	sequenceOrder: number,
	type: TripWaypointType
): ConfigureTripWaypointsFormValues["waypoints"][number] {
	return {
		checkpointId: "",
		type,
		name: "",
		longitude: "108.2208",
		latitude: "16.0471",
		dayNumber: "1",
		sequenceOrder: String(sequenceOrder),
		plannedAt: "",
		durationMinutes: "",
	};
}

function waypointListError(values: ConfigureTripWaypointsFormValues): string {
	if (!values.waypoints.some((waypoint) => waypoint.type === "start")) {
		return "Trip phải có waypoint bắt đầu.";
	}
	if (!values.waypoints.some((waypoint) => waypoint.type === "finish")) {
		return "Trip phải có waypoint kết thúc.";
	}
	return "";
}

function statusLabel(status: Trip["status"]): string {
	const labels: Record<Trip["status"], string> = {
		draft: "Draft",
		pending_approval: "Chờ duyệt",
		published: "Đã publish",
		ongoing: "Đang diễn ra",
		completed: "Hoàn tất",
		cancelled: "Đã hủy",
	};
	return labels[status];
}

function canConfigure(status: Trip["status"]): boolean {
	return status === "draft" || status === "pending_approval";
}

function checkpointOptionLabel(checkpoint: RouteCheckpoint): string {
	return `${checkpoint.name} (${checkpoint.type})`;
}

export function ConfigureTripWaypointsPanel({ trip }: Props) {
	const checkpoints = useRouteCheckpoints(trip.routeId);
	const configuration = useConfigureTripWaypoints(trip.id);
	const serverTrip = configuration.configuredTrip ?? trip;
	const isBlocked = !canConfigure(serverTrip.status);
	const isPendingSuccess = serverTrip.status === "pending_approval";
	const schema = useMemo(() => createConfigureTripWaypointsSchema(serverTrip), [serverTrip]);
	const defaultValues = useMemo(
		() => toConfigureTripWaypointsDefaultValues(serverTrip),
		[serverTrip]
	);
	const {
		control,
		register,
		handleSubmit,
		setError,
		setValue,
		watch,
		reset,
		formState: { errors },
	} = useForm<ConfigureTripWaypointsFormValues>({
		resolver: zodResolver(schema),
		defaultValues,
		mode: "onChange",
	});
	const { fields, append, remove } = useFieldArray({ control, name: "waypoints" });
	const currentValues = watch();
	const listError =
		errors.waypoints?.message ||
		errors.waypoints?.root?.message ||
		waypointListError(currentValues);
	const submitDisabled = configuration.isSubmitting || isBlocked || fields.length < 2;

	useEffect(() => {
		reset(defaultValues);
	}, [defaultValues, reset]);

	useEffect(() => {
		if (!configuration.error) return;
		for (const [field, message] of Object.entries(configuration.error.fieldErrors)) {
			if (backendFieldMap[field] || field.startsWith("waypoints")) {
				setError("waypoints", { message });
			}
		}
	}, [configuration.error, setError]);

	const applyCheckpoint = (index: number, checkpointId: string) => {
		const checkpoint = checkpoints.items.find((item) => item.id === checkpointId);
		if (!checkpoint) return;
		setValue(`waypoints.${index}.checkpointId`, checkpoint.id, { shouldValidate: true });
		setValue(`waypoints.${index}.type`, "checkpoint", { shouldValidate: true });
		setValue(`waypoints.${index}.name`, checkpoint.name, { shouldValidate: true });
		setValue(`waypoints.${index}.longitude`, String(checkpoint.location.coordinates[0]), {
			shouldValidate: true,
		});
		setValue(`waypoints.${index}.latitude`, String(checkpoint.location.coordinates[1]), {
			shouldValidate: true,
		});
	};

	const appendWaypoint = () => {
		const type: TripWaypointType = serverTrip.tripType === "overnight" ? "overnight" : "rest";
		append(toNewWaypoint(fields.length + 1, type));
	};

	const submitForm = (values: ConfigureTripWaypointsFormValues) =>
		configuration.submit(toConfigureTripWaypointsInput(values));

	return (
		<section className="mt-6 rounded-2xl border border-[#dce8dd] bg-white p-5 shadow-sm">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="flex gap-3">
					<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#164027]">
						<MapPin className="size-5" />
					</div>
					<div>
						<p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#728578]">
							Waypoint
						</p>
						<h2 className="mt-1 text-lg font-extrabold text-[#10221b]">
							Cấu hình waypoint và gửi duyệt
						</h2>
						<p className="mt-2 text-sm leading-6 text-[#667a6d]">
							Backend sẽ xác nhận quyền Host, trạng thái Trip và checkpoint cùng route trước khi
							submit.
						</p>
					</div>
				</div>
				<div className="rounded-xl bg-[#f8faf7] px-4 py-3 text-sm text-[#34483b]">
					<p>
						<b>Trip ID:</b> <span className="font-mono">{serverTrip.id}</span>
					</p>
					<p>
						<b>Trạng thái:</b> <span data-testid="configure-trip-status">{serverTrip.status}</span>
					</p>
				</div>
			</div>

			{isBlocked && (
				<p
					role="alert"
					className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
				>
					Trip đang ở trạng thái {statusLabel(serverTrip.status)}, nên không thể cấu hình waypoint.
				</p>
			)}

			{isPendingSuccess && (
				<div className="mt-4 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
					<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
					<span>Waypoint đã được backend xác nhận và Trip hiện đang chờ duyệt.</span>
				</div>
			)}

			{checkpoints.isLoading && (
				<p className="mt-4 flex items-center gap-2 rounded-xl border border-[#dce8dd] bg-[#f8faf7] p-3 text-sm text-[#34483b]">
					<Loader2 className="size-4 animate-spin" />
					Đang tải checkpoint của tuyến...
				</p>
			)}
			{checkpoints.error && (
				<div
					role="alert"
					className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
				>
					<p>{checkpoints.error}</p>
					<button
						type="button"
						onClick={() => void checkpoints.reload()}
						className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 font-bold"
					>
						<RefreshCw className="size-4" />
						Tải lại checkpoint
					</button>
				</div>
			)}
			{!checkpoints.isLoading && !checkpoints.error && checkpoints.items.length === 0 && (
				<p className="mt-4 rounded-xl border border-[#dce8dd] bg-[#f8faf7] p-3 text-sm text-[#667a6d]">
					Chưa có checkpoint từ tuyến. Host vẫn có thể dùng custom location cho waypoint.
				</p>
			)}

			<form className="mt-5 grid gap-4" onSubmit={handleSubmit(submitForm)}>
				{fields.map((field, index) => {
					const checkpointValue = watch(`waypoints.${index}.checkpointId`);
					return (
						<div key={field.id} className="rounded-xl border border-[#e0ebe0] bg-[#fbfdfb] p-4">
							<div className="flex items-start justify-between gap-3">
								<h3 className="font-extrabold text-[#10221b]">Waypoint {index + 1}</h3>
								<button
									type="button"
									aria-label={`Xóa waypoint ${index + 1}`}
									onClick={() => remove(index)}
									disabled={configuration.isSubmitting || fields.length <= 2}
									className="rounded-lg border border-red-200 p-2 text-red-700 disabled:opacity-50"
								>
									<Trash2 className="size-4" />
								</button>
							</div>
							<div className="mt-4 grid gap-3 md:grid-cols-3">
								<input type="hidden" {...register(`waypoints.${index}.checkpointId`)} />
								<label className="text-sm font-bold text-[#34483b]">
									Checkpoint cùng route
									<select
										aria-label={`Checkpoint waypoint ${index + 1}`}
										disabled={configuration.isSubmitting || checkpoints.isLoading}
										className={inputClass}
										value={checkpointValue}
										onChange={(event) => {
											setValue(`waypoints.${index}.checkpointId`, event.target.value, {
												shouldValidate: true,
											});
											if (event.target.value) applyCheckpoint(index, event.target.value);
										}}
									>
										<option value="">Custom location</option>
										{checkpoints.items.map((checkpoint) => (
											<option key={checkpoint.id} value={checkpoint.id}>
												{checkpointOptionLabel(checkpoint)}
											</option>
										))}
									</select>
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Loại waypoint
									<select
										aria-label={`Loại waypoint ${index + 1}`}
										disabled={configuration.isSubmitting}
										className={inputClass}
										{...register(`waypoints.${index}.type`)}
									>
										{Object.entries(waypointTypeLabels).map(([type, label]) => (
											<option key={type} value={type}>
												{label}
											</option>
										))}
									</select>
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Tên waypoint
									<input
										aria-label={`Tên waypoint ${index + 1}`}
										disabled={configuration.isSubmitting}
										maxLength={150}
										className={inputClass}
										{...register(`waypoints.${index}.name`)}
									/>
									{errors.waypoints?.[index]?.name && (
										<span className="mt-1 block text-xs text-red-600">
											{errors.waypoints[index]?.name?.message}
										</span>
									)}
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Kinh độ
									<input
										aria-label={`Kinh độ waypoint ${index + 1}`}
										disabled={configuration.isSubmitting}
										inputMode="decimal"
										className={inputClass}
										{...register(`waypoints.${index}.longitude`)}
									/>
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Vĩ độ
									<input
										aria-label={`Vĩ độ waypoint ${index + 1}`}
										disabled={configuration.isSubmitting}
										inputMode="decimal"
										className={inputClass}
										{...register(`waypoints.${index}.latitude`)}
									/>
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Ngày
									<input
										aria-label={`Ngày waypoint ${index + 1}`}
										disabled={configuration.isSubmitting}
										inputMode="numeric"
										className={inputClass}
										{...register(`waypoints.${index}.dayNumber`)}
									/>
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Thứ tự
									<input
										aria-label={`Thứ tự waypoint ${index + 1}`}
										disabled={configuration.isSubmitting}
										inputMode="numeric"
										className={inputClass}
										{...register(`waypoints.${index}.sequenceOrder`)}
									/>
									{errors.waypoints?.[index]?.sequenceOrder && (
										<span className="mt-1 block text-xs text-red-600">
											{errors.waypoints[index]?.sequenceOrder?.message}
										</span>
									)}
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Thời gian dự kiến
									<input
										aria-label={`Thời gian waypoint ${index + 1}`}
										type="datetime-local"
										disabled={configuration.isSubmitting}
										className={inputClass}
										{...register(`waypoints.${index}.plannedAt`)}
									/>
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Thời lượng dừng
									<input
										aria-label={`Thời lượng waypoint ${index + 1}`}
										disabled={configuration.isSubmitting}
										inputMode="numeric"
										placeholder="Phút"
										className={inputClass}
										{...register(`waypoints.${index}.durationMinutes`)}
									/>
								</label>
							</div>
						</div>
					);
				})}

				{listError && (
					<p
						role="alert"
						className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
					>
						{listError}
					</p>
				)}

				{configuration.error && (
					<ConfigureErrorAlert error={configuration.error} onRetry={configuration.retry} />
				)}

				<div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
					<button
						type="button"
						onClick={appendWaypoint}
						disabled={configuration.isSubmitting || isBlocked}
						className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cbd9ce] px-4 py-3 font-bold text-[#164027] disabled:opacity-60"
					>
						<Plus className="size-4" />
						Thêm waypoint
					</button>
					<button
						type="submit"
						disabled={submitDisabled}
						className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-5 py-3 font-bold text-white disabled:opacity-60"
					>
						{configuration.isSubmitting ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Send className="size-4" />
						)}
						{configuration.isSubmitting ? "Đang gửi duyệt..." : "Lưu waypoint và gửi duyệt"}
					</button>
				</div>
			</form>
		</section>
	);
}

function ConfigureErrorAlert({
	error,
	onRetry,
}: {
	error: ConfigureTripWaypointsError;
	onRetry: () => Promise<unknown>;
}) {
	return (
		<div
			role="alert"
			className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
		>
			<div className="flex gap-2">
				<AlertCircle className="size-5 shrink-0" />
				<span>{error.message}</span>
			</div>
			{error.canRetry && (
				<button
					type="button"
					onClick={() => void onRetry()}
					className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-bold"
				>
					<RefreshCw className="mr-1 inline size-4" />
					Thử lại
				</button>
			)}
		</div>
	);
}
