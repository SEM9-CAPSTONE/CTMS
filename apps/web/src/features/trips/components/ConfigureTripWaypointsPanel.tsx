import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertCircle,
	CheckCircle2,
	Loader2,
	MapPin,
	RefreshCw,
	Send,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useRouteCheckpoints } from "../../trekking-routes/hooks/useRouteCheckpoints";
import type { CreatedTrekkingRoute, Position } from "../../trekking-routes/types";
import type { ConfigureTripWaypointsError } from "../hooks/useConfigureTripWaypoints";
import { useConfigureTripWaypoints } from "../hooks/useConfigureTripWaypoints";
import {
	type ConfigureTripWaypointsFormValues,
	createConfigureTripWaypointsSchema,
	toConfigureTripWaypointsDefaultValues,
	toConfigureTripWaypointsInput,
} from "../schema/configure-trip-waypoints.schema";
import { type Trip, type TripWaypointType, formatTripStatus } from "../types";
import { SoftSingleDateTimePicker } from "./TripDateTimePicker";
import { TripWaypointLocationMap } from "./TripWaypointLocationMap";

interface Props {
	trip: Trip;
	route?: CreatedTrekkingRoute | null;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-[#f4f7f2] disabled:text-[#7b8c82]";

const waypointTypeLabels: Record<TripWaypointType, string> = {
	start: "Bắt đầu",
	checkpoint: "Điểm kiểm tra có sẵn",
	rest: "Nghỉ chân",
	meal: "Ăn uống",
	activity: "Hoạt động",
	overnight: "Chỗ ngủ",
	finish: "Kết thúc",
};

const editableWaypointTypes: TripWaypointType[] = ["rest", "meal", "activity", "overnight"];

const backendFieldMap: Record<string, "waypoints"> = {
	"waypoints.checkpointId": "waypoints",
	waypoints: "waypoints",
};

function toNewWaypoint(
	type: TripWaypointType
): ConfigureTripWaypointsFormValues["waypoints"][number] {
	return {
		checkpointId: "",
		type,
		name: "",
		longitude: "",
		latitude: "",
		routeOrder: "",
		plannedAt: "",
	};
}

function waypointListError(values: ConfigureTripWaypointsFormValues): string {
	if (!values.waypoints.some((waypoint) => waypoint.type === "start")) {
		return "Chuyến đi phải có điểm bắt đầu.";
	}
	if (!values.waypoints.some((waypoint) => waypoint.type === "finish")) {
		return "Chuyến đi phải có điểm kết thúc.";
	}
	return "";
}

function canConfigure(status: Trip["status"]): boolean {
	return status === "draft" || status === "pending_approval";
}

function formatPosition(longitude: string, latitude: string): string {
	if (!longitude?.trim() || !latitude?.trim()) return "Chưa chọn vị trí";
	const parsedLongitude = Number(longitude);
	const parsedLatitude = Number(latitude);
	if (!Number.isFinite(parsedLongitude) || !Number.isFinite(parsedLatitude)) {
		return "Chưa chọn vị trí";
	}
	return `${parsedLongitude.toFixed(6)}, ${parsedLatitude.toFixed(6)}`;
}

function isFixedEndpoint(type: TripWaypointType): boolean {
	return type === "start" || type === "finish";
}

function formatWaypointDateTime(value: string): string {
	if (!value) return "Chưa chọn thời gian";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Thời gian chưa hợp lệ";
	return new Intl.DateTimeFormat("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

function hasPosition(waypoint: ConfigureTripWaypointsFormValues["waypoints"][number]): boolean {
	return Boolean(waypoint.longitude?.trim() && waypoint.latitude?.trim());
}

function getDayLabel(
	trip: Trip,
	waypoint: ConfigureTripWaypointsFormValues["waypoints"][number]
): string {
	if (!waypoint.plannedAt) {
		if (trip.tripType === "day_trip" && hasPosition(waypoint)) return "Ngày 1";
		if (trip.tripType === "overnight" && hasPosition(waypoint)) return "Chọn ngày/giờ";
		return "Chưa chọn vị trí";
	}
	const start = new Date(trip.startsAt);
	const planned = new Date(waypoint.plannedAt);
	if (Number.isNaN(start.getTime()) || Number.isNaN(planned.getTime()))
		return trip.tripType === "day_trip" ? "Ngày 1" : "Chọn ngày/giờ";
	const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	const plannedDate = new Date(planned.getFullYear(), planned.getMonth(), planned.getDate());
	const dayNumber = Math.floor((plannedDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
	return `Ngày ${Math.max(1, dayNumber)}`;
}

function toDateTimeLocalValue(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return localDate.toISOString().slice(0, 16);
}

export function ConfigureTripWaypointsPanel({ trip, route }: Props) {
	const checkpoints = useRouteCheckpoints(trip.routeId);
	const configuration = useConfigureTripWaypoints(trip.id);
	const [activeWaypointIndex, setActiveWaypointIndex] = useState(0);
	const [waypointFormIndex, setWaypointFormIndex] = useState<number | null>(null);
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
		getValues,
		formState: { errors },
	} = useForm<ConfigureTripWaypointsFormValues>({
		resolver: zodResolver(schema),
		defaultValues,
		mode: "onChange",
	});
	const { fields, insert, remove } = useFieldArray({
		control,
		name: "waypoints",
	});
	const currentValues = watch();
	const timelineItems = [...currentValues.waypoints]
		.map((waypoint, index) => ({ ...waypoint, index }))
		.sort(
			(first, second) =>
				Number(first.routeOrder || Number.MAX_SAFE_INTEGER) -
				Number(second.routeOrder || Number.MAX_SAFE_INTEGER)
		);
	const listError =
		errors.waypoints?.message ||
		errors.waypoints?.root?.message ||
		waypointListError(currentValues);
	const submitDisabled = configuration.isSubmitting || isBlocked || fields.length < 2;

	useEffect(() => {
		reset(defaultValues);
	}, [defaultValues, reset]);

	useEffect(() => {
		const routeCoordinates = route?.geometry.coordinates;
		if (!routeCoordinates?.length) return;
		const waypoints = getValues("waypoints");
		const startIndex = waypoints.findIndex((waypoint) => waypoint.type === "start");
		const finishIndex = waypoints.findIndex((waypoint) => waypoint.type === "finish");
		const start = routeCoordinates[0];
		const finish = routeCoordinates.at(-1);
		if (startIndex >= 0 && start) {
			setValue(`waypoints.${startIndex}.longitude`, String(start[0]), {
				shouldValidate: true,
			});
			setValue(`waypoints.${startIndex}.latitude`, String(start[1]), {
				shouldValidate: true,
			});
			setValue(`waypoints.${startIndex}.routeOrder`, "0", {
				shouldValidate: true,
			});
		}
		if (finishIndex >= 0 && finish) {
			setValue(`waypoints.${finishIndex}.longitude`, String(finish[0]), {
				shouldValidate: true,
			});
			setValue(`waypoints.${finishIndex}.latitude`, String(finish[1]), {
				shouldValidate: true,
			});
			setValue(`waypoints.${finishIndex}.routeOrder`, "1", {
				shouldValidate: true,
			});
		}
	}, [getValues, route?.geometry.coordinates, setValue]);

	useEffect(() => {
		if (!configuration.error) return;
		for (const [field, message] of Object.entries(configuration.error.fieldErrors)) {
			if (backendFieldMap[field] || field.startsWith("waypoints")) {
				setError("waypoints", { message });
			}
		}
	}, [configuration.error, setError]);

	const openWaypointForm = (index: number) => {
		setActiveWaypointIndex(index);
		setWaypointFormIndex(index);
	};

	const findRouteInsertIndex = (routeOrder: number) => {
		const finishIndex = currentValues.waypoints.findIndex((waypoint) => waypoint.type === "finish");
		const nextRouteWaypointIndex = currentValues.waypoints.findIndex((waypoint) => {
			if (isFixedEndpoint(waypoint.type)) return false;
			const waypointRouteOrder = Number(waypoint.routeOrder);
			return Number.isFinite(waypointRouteOrder) && waypointRouteOrder > routeOrder;
		});
		if (nextRouteWaypointIndex >= 0) return nextRouteWaypointIndex;
		return finishIndex >= 0 ? finishIndex : fields.length;
	};

	const selectWaypointLocation = ([longitude, latitude]: Position, routeOrder: number) => {
		const existingIndex = currentValues.waypoints.findIndex(
			(waypoint) => !isFixedEndpoint(waypoint.type) && Number(waypoint.routeOrder) === routeOrder
		);
		if (existingIndex >= 0 && waypointFormIndex !== existingIndex) {
			setActiveWaypointIndex(existingIndex);
			setWaypointFormIndex(existingIndex);
			return;
		}

		const activeWaypoint = currentValues.waypoints[activeWaypointIndex];
		const shouldUpdateActive =
			waypointFormIndex === activeWaypointIndex &&
			Boolean(activeWaypoint) &&
			!isFixedEndpoint(activeWaypoint.type);

		if (shouldUpdateActive) {
			setValue(`waypoints.${activeWaypointIndex}.checkpointId`, "", {
				shouldValidate: true,
			});
			setValue(`waypoints.${activeWaypointIndex}.longitude`, String(longitude), {
				shouldValidate: true,
			});
			setValue(`waypoints.${activeWaypointIndex}.latitude`, String(latitude), {
				shouldValidate: true,
			});
			setValue(`waypoints.${activeWaypointIndex}.routeOrder`, String(routeOrder), {
				shouldValidate: true,
			});
			setWaypointFormIndex(activeWaypointIndex);
			return;
		}

		const type: TripWaypointType = serverTrip.tripType === "overnight" ? "overnight" : "rest";
		const insertIndex = findRouteInsertIndex(routeOrder);
		insert(insertIndex, {
			...toNewWaypoint(type),
			name: "",
			longitude: String(longitude),
			latitude: String(latitude),
			routeOrder: String(routeOrder),
		});
		setActiveWaypointIndex(insertIndex);
		setWaypointFormIndex(insertIndex);
	};

	const moveWaypointLocation = (
		index: number,
		[longitude, latitude]: Position,
		routeOrder: number
	) => {
		const waypoint = currentValues.waypoints[index];
		if (!waypoint || isFixedEndpoint(waypoint.type)) return;
		setValue(`waypoints.${index}.checkpointId`, "", {
			shouldValidate: true,
		});
		setValue(`waypoints.${index}.longitude`, String(longitude), {
			shouldValidate: true,
		});
		setValue(`waypoints.${index}.latitude`, String(latitude), {
			shouldValidate: true,
		});
		setValue(`waypoints.${index}.routeOrder`, String(routeOrder), {
			shouldValidate: true,
		});
		setActiveWaypointIndex(index);
		setWaypointFormIndex(index);
	};

	const activeEditorWaypoint =
		waypointFormIndex !== null ? currentValues.waypoints[waypointFormIndex] : null;
	const activeEditorLocked = activeEditorWaypoint
		? isFixedEndpoint(activeEditorWaypoint.type)
		: false;
	const activeWaypointEditor =
		waypointFormIndex !== null && activeEditorWaypoint ? (
			<div aria-label={`Thông tin điểm dừng ${waypointFormIndex + 1}`}>
				<div className="flex items-start justify-between gap-2">
					<div>
						<p className="text-sm font-extrabold text-[#10221b]">
							Điểm dừng {waypointFormIndex + 1}
						</p>
						<p className="mt-0.5 text-xs font-semibold text-[#667a6d]">
							{formatPosition(activeEditorWaypoint.longitude, activeEditorWaypoint.latitude)}
						</p>
					</div>
					<button
						type="button"
						aria-label="Đóng form điểm dừng"
						onClick={() => setWaypointFormIndex(null)}
						className="rounded-lg border border-[#dce8dd] p-1.5 text-[#34483b]"
					>
						<X className="size-4" />
					</button>
				</div>
				<div className="mt-3 grid gap-3">
					{activeEditorLocked ? (
						<div>
							<p className="text-xs font-bold text-[#34483b]">Điểm dừng</p>
							<span className="mt-1 inline-flex min-h-10 w-full items-center rounded-xl bg-[#f8faf7] px-3 text-sm font-extrabold text-[#164027] ring-1 ring-[#dce8dd]">
								{waypointTypeLabels[activeEditorWaypoint.type]}
							</span>
						</div>
					) : (
						<label className="text-xs font-bold text-[#34483b]">
							Điểm dừng
							<select
								aria-label={`Điểm dừng ${waypointFormIndex + 1}`}
								disabled={configuration.isSubmitting}
								className={inputClass}
								{...register(`waypoints.${waypointFormIndex}.type`)}
							>
								{editableWaypointTypes.map((type) => (
									<option key={type} value={type}>
										{waypointTypeLabels[type]}
									</option>
								))}
							</select>
						</label>
					)}
					<label className="text-xs font-bold text-[#34483b]">
						Mô tả
						<input
							aria-label={`Mô tả điểm dừng ${waypointFormIndex + 1}`}
							disabled={configuration.isSubmitting}
							maxLength={150}
							placeholder="Nhập mô tả"
							className={inputClass}
							{...register(`waypoints.${waypointFormIndex}.name`)}
						/>
						{errors.waypoints?.[waypointFormIndex]?.name && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.waypoints[waypointFormIndex]?.name?.message}
							</span>
						)}
					</label>
					<div>
						<SoftSingleDateTimePicker
							modal
							title="Thời gian dự kiến"
							value={activeEditorWaypoint.plannedAt}
							minValue={toDateTimeLocalValue(serverTrip.startsAt)}
							maxValue={toDateTimeLocalValue(serverTrip.endsAt)}
							disabled={configuration.isSubmitting}
							error={errors.waypoints?.[waypointFormIndex]?.plannedAt?.message}
							onChange={(value) => {
								setValue(`waypoints.${waypointFormIndex}.plannedAt`, value, {
									shouldDirty: true,
									shouldValidate: true,
								});
							}}
						/>
						<input
							aria-label={`Thời gian điểm dừng ${waypointFormIndex + 1}`}
							type="datetime-local"
							min={toDateTimeLocalValue(serverTrip.startsAt)}
							max={toDateTimeLocalValue(serverTrip.endsAt)}
							disabled={configuration.isSubmitting}
							className="sr-only"
							{...register(`waypoints.${waypointFormIndex}.plannedAt`)}
						/>
					</div>
				</div>
				<div className="mt-3 flex justify-between gap-2">
					<button
						type="button"
						onClick={() => {
							remove(waypointFormIndex);
							setActiveWaypointIndex(Math.max(0, waypointFormIndex - 1));
							setWaypointFormIndex(null);
						}}
						disabled={configuration.isSubmitting || fields.length <= 2 || activeEditorLocked}
						className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
					>
						<Trash2 className="size-4" />
						Xóa
					</button>
					<button
						type="button"
						onClick={() => setWaypointFormIndex(null)}
						className="rounded-lg bg-[#164027] px-3 py-2 text-sm font-bold text-white"
					>
						Xong
					</button>
				</div>
				{!activeEditorLocked && (
					<p className="mt-2 text-xs font-semibold text-[#667a6d]">
						Bấm vị trí khác trên tuyến để di chuyển điểm này.
					</p>
				)}
			</div>
		) : null;

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
							Điểm dừng
						</p>
						<h2 className="mt-1 text-lg font-extrabold text-[#10221b]">
							Lịch trình điểm dừng và gửi duyệt
						</h2>
					</div>
				</div>
				<div className="rounded-xl bg-[#f8faf7] px-4 py-3 text-sm text-[#34483b]">
					<p>
						<b>Trạng thái:</b>{" "}
						<span data-testid="configure-trip-status">{formatTripStatus(serverTrip.status)}</span>
					</p>
				</div>
			</div>

			{isBlocked && (
				<p
					role="alert"
					className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
				>
					Chuyến đi đang ở trạng thái {formatTripStatus(serverTrip.status)}, nên không thể cấu hình
					điểm dừng.
				</p>
			)}

			{isPendingSuccess && (
				<div className="mt-4 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
					<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
					<span>Lịch trình đã được lưu và chuyến đi đang chờ duyệt.</span>
				</div>
			)}

			{checkpoints.isLoading && (
				<p className="mt-4 flex items-center gap-2 rounded-xl border border-[#dce8dd] bg-[#f8faf7] p-3 text-sm text-[#34483b]">
					<Loader2 className="size-4 animate-spin" />
					Đang tải điểm kiểm tra của tuyến...
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
						Tải lại điểm kiểm tra
					</button>
				</div>
			)}
			<form className="mt-5 grid gap-5" noValidate onSubmit={handleSubmit(submitForm)}>
				<div className="rounded-2xl border border-[#dce8dd] bg-[#f8faf7] p-4">
					<h3 className="font-extrabold text-[#10221b]">Lịch trình dự kiến</h3>
					<div className="mt-3 grid gap-2">
						{fields.map((field, index) => (
							<div key={field.id} className="hidden">
								<input type="hidden" {...register(`waypoints.${index}.checkpointId`)} />
								<input type="hidden" {...register(`waypoints.${index}.longitude`)} />
								<input type="hidden" {...register(`waypoints.${index}.latitude`)} />
								<input type="hidden" {...register(`waypoints.${index}.routeOrder`)} />
								<input type="hidden" {...register(`waypoints.${index}.type`)} />
								<input type="hidden" {...register(`waypoints.${index}.name`)} />
								<input type="hidden" {...register(`waypoints.${index}.plannedAt`)} />
							</div>
						))}
						{timelineItems.map((waypoint, displayIndex) => (
							<button
								key={`${waypoint.index}-${waypoint.type}`}
								type="button"
								onClick={() => openWaypointForm(waypoint.index)}
								aria-label={`Mở chỉnh sửa điểm dừng ${waypoint.index + 1}`}
								className={`grid gap-2 rounded-lg bg-white p-3 text-left text-sm ring-1 transition hover:ring-[#164027]/30 sm:grid-cols-[88px_120px_1fr] ${
									activeWaypointIndex === waypoint.index ? "ring-[#164027]" : "ring-[#e0ebe0]"
								}`}
							>
								<span className="font-bold text-[#164027]">
									{formatWaypointDateTime(waypoint.plannedAt)}
								</span>
								<span className="font-semibold text-[#667a6d]">
									{getDayLabel(serverTrip, waypoint)}
								</span>
								<span>
									<b>{waypointTypeLabels[waypoint.type]}</b>
									{waypoint.name ? ` - ${waypoint.name}` : ""}
								</span>
								<span className="sr-only">Điểm {displayIndex + 1} trên tuyến</span>
							</button>
						))}
					</div>
				</div>

				<TripWaypointLocationMap
					route={route}
					checkpoints={checkpoints.items}
					waypoints={currentValues.waypoints}
					activeIndex={activeWaypointIndex}
					disabled={configuration.isSubmitting || isBlocked}
					editor={activeWaypointEditor}
					onActiveIndexChange={openWaypointForm}
					onRouteNodeSelect={selectWaypointLocation}
					onWaypointMove={moveWaypointLocation}
				/>

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
						type="submit"
						disabled={submitDisabled}
						className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-5 py-3 font-bold text-white disabled:opacity-60"
					>
						{configuration.isSubmitting ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Send className="size-4" />
						)}
						{configuration.isSubmitting ? "Đang gửi duyệt..." : "Gửi duyệt"}
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
