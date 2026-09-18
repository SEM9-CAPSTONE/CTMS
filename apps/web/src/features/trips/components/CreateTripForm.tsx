import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, ImagePlus, Loader2, RefreshCw, Route, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { CreatedTrekkingRoute, Position } from "../../trekking-routes/types";
import type { CreateTripError } from "../hooks/useCreateTrip";
import {
	CREATE_TRIP_DEFAULT_VALUES,
	type CreateTripFormValues,
	createTripFormSchema,
	toCreateTripInput,
} from "../schema/create-trip.schema";
import type { CreateTripInput } from "../types";
import { TripRouteMap } from "./TripRouteMap";

interface Props {
	activeRoutes: CreatedTrekkingRoute[];
	isRouteLoading: boolean;
	routeError: string;
	isSubmitting: boolean;
	error: CreateTripError | null;
	onSubmit: (payload: CreateTripInput) => Promise<unknown>;
	onRetry: () => Promise<unknown>;
	onRetryRoutes: () => void;
	onCreateRoute?: () => void;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-[#f4f7f2] disabled:text-[#7b8c82]";
const MAX_COVER_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_REASONABLE_TREKKING_METERS_PER_MINUTE = 100;

const backendFieldMap: Record<string, keyof CreateTripFormValues> = {
	endsAt: "endsAt",
	bookingDeadline: "bookingDeadline",
	meetingAt: "meetingAt",
	capacityMin: "capacityMin",
	waypoints: "waypoints",
};

function toDateTimeLocalInputValue(date: Date): string {
	const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return localDate.toISOString().slice(0, 16);
}

function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes} phút`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes ? `${hours} giờ ${remainingMinutes} phút` : `${hours} giờ`;
}

function getMinimumTripDurationMinutes(route: CreatedTrekkingRoute): number {
	if (route.expectedDurationMinutes > 0) return route.expectedDurationMinutes;
	return Math.ceil(route.lengthMeters / MAX_REASONABLE_TREKKING_METERS_PER_MINUTE);
}

function getRouteDurationError(
	startsAt: string,
	endsAt: string,
	route: CreatedTrekkingRoute | null
): string {
	if (!route || !startsAt || !endsAt) return "";
	const startTime = new Date(startsAt).getTime();
	const endTime = new Date(endsAt).getTime();
	if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return "";
	const durationMinutes = Math.round((endTime - startTime) / 60_000);
	const minimumMinutes = getMinimumTripDurationMinutes(route);
	if (durationMinutes >= minimumMinutes) return "";
	const routeKilometers = (route.lengthMeters / 1000).toFixed(1);
	return `Thời lượng trip quá ngắn cho tuyến ${routeKilometers} km. Cần tối thiểu ${formatDuration(minimumMinutes)}.`;
}

export function CreateTripForm({
	activeRoutes,
	isRouteLoading,
	routeError,
	isSubmitting,
	error,
	onSubmit,
	onRetry,
	onRetryRoutes,
	onCreateRoute,
}: Props) {
	const {
		register,
		handleSubmit,
		clearErrors,
		setError,
		setValue,
		watch,
		formState: { errors },
	} = useForm<CreateTripFormValues>({
		resolver: zodResolver(createTripFormSchema),
		defaultValues: CREATE_TRIP_DEFAULT_VALUES,
		mode: "onChange",
	});
	const selectedRouteId = watch("routeId");
	const startsAt = watch("startsAt");
	const endsAt = watch("endsAt");
	const [coverImagePreview, setCoverImagePreview] = useState("");
	const minDateTime = useMemo(() => toDateTimeLocalInputValue(new Date()), []);
	const meetingPoint: Position = [
		Number(watch("meetingLongitude")),
		Number(watch("meetingLatitude")),
	];
	const hasActiveRoutes = activeRoutes.length > 0;
	const selectedRoute = activeRoutes.find((route) => route.id === selectedRouteId) ?? null;
	const routeDurationError = getRouteDurationError(startsAt, endsAt, selectedRoute);
	const endsAtErrorMessage = routeDurationError || errors.endsAt?.message;
	const routeSelectDisabled = isSubmitting || isRouteLoading || !hasActiveRoutes;
	const submitDisabled = isSubmitting || !hasActiveRoutes || !selectedRouteId;

	useEffect(() => {
		if (!hasActiveRoutes || selectedRouteId) return;
		setValue("routeId", activeRoutes[0].id, { shouldValidate: true });
	}, [activeRoutes, hasActiveRoutes, selectedRouteId, setValue]);

	useEffect(() => {
		if (!selectedRoute) return;
		const start = selectedRoute.geometry.coordinates[0];
		const finish = selectedRoute.geometry.coordinates.at(-1);
		if (!start || !finish) return;
		setValue("meetingLongitude", String(start[0]), { shouldValidate: true });
		setValue("meetingLatitude", String(start[1]), { shouldValidate: true });
		setValue("waypoints.0.type", "start");
		setValue("waypoints.0.name", `${selectedRoute.name} - điểm bắt đầu`, { shouldValidate: true });
		setValue("waypoints.0.longitude", String(start[0]), { shouldValidate: true });
		setValue("waypoints.0.latitude", String(start[1]), { shouldValidate: true });
		setValue("waypoints.0.dayNumber", "1", { shouldValidate: true });
		setValue("waypoints.0.sequenceOrder", "1", { shouldValidate: true });
		setValue("waypoints.1.type", "finish");
		setValue("waypoints.1.name", `${selectedRoute.name} - điểm kết thúc`, { shouldValidate: true });
		setValue("waypoints.1.longitude", String(finish[0]), { shouldValidate: true });
		setValue("waypoints.1.latitude", String(finish[1]), { shouldValidate: true });
		setValue("waypoints.1.dayNumber", "1", { shouldValidate: true });
		setValue("waypoints.1.sequenceOrder", "2", { shouldValidate: true });
	}, [selectedRoute, setValue]);

	useEffect(() => {
		if (startsAt) setValue("waypoints.0.plannedAt", startsAt, { shouldValidate: true });
	}, [setValue, startsAt]);

	useEffect(() => {
		if (endsAt) setValue("waypoints.1.plannedAt", endsAt, { shouldValidate: true });
	}, [endsAt, setValue]);

	useEffect(() => {
		if (routeDurationError) {
			setError("endsAt", { type: "routeDuration", message: routeDurationError });
			return;
		}
		if (errors.endsAt?.type === "routeDuration") clearErrors("endsAt");
	}, [clearErrors, errors.endsAt?.type, routeDurationError, setError]);

	const setMeetingPoint = ([longitude, latitude]: Position) => {
		setValue("meetingLongitude", String(longitude), { shouldValidate: true });
		setValue("meetingLatitude", String(latitude), { shouldValidate: true });
	};

	const handleCoverImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			setError("coverImageUrl", { message: "Ảnh bìa phải là file hình ảnh" });
			event.target.value = "";
			return;
		}
		if (file.size > MAX_COVER_IMAGE_SIZE) {
			setError("coverImageUrl", { message: "Ảnh bìa không được vượt quá 5 MB" });
			event.target.value = "";
			return;
		}
		clearErrors("coverImageUrl");
		setValue("coverImageUrl", "", { shouldValidate: true });
		setCoverImagePreview((current) => {
			if (current) URL.revokeObjectURL(current);
			return URL.createObjectURL(file);
		});
	};

	const clearCoverImage = () => {
		setCoverImagePreview((current) => {
			if (current) URL.revokeObjectURL(current);
			return "";
		});
		clearErrors("coverImageUrl");
		setValue("coverImageUrl", "", { shouldValidate: true });
	};

	useEffect(
		() => () => {
			if (coverImagePreview) URL.revokeObjectURL(coverImagePreview);
		},
		[coverImagePreview]
	);

	useEffect(() => {
		if (!error) return;
		for (const [field, message] of Object.entries(error.fieldErrors)) {
			const mapped = backendFieldMap[field];
			if (mapped) setError(mapped, { message });
		}
	}, [error, setError]);

	const submitForm = (values: CreateTripFormValues) => {
		const durationError = getRouteDurationError(values.startsAt, values.endsAt, selectedRoute);
		if (durationError) {
			setError("endsAt", { type: "routeDuration", message: durationError });
			return Promise.resolve();
		}
		return onSubmit(toCreateTripInput(values));
	};

	return (
		<form className="grid gap-5" onSubmit={handleSubmit(submitForm)}>
			<section className="overflow-hidden rounded-2xl border border-[#dce8dd] bg-white shadow-sm">
				<div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
					<div className="bg-[#f7faf6] p-5">
						<div className="flex items-start gap-3">
							<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#164027]">
								<Route className="size-5" />
							</div>
							<div>
								<p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#728578]">
									Tuyến trekking
								</p>
								<h2 className="mt-1 text-lg font-extrabold text-[#10221b]">
									Chọn tuyến đã duyệt để tạo trip
								</h2>
								<p className="mt-2 text-sm leading-6 text-[#667a6d]">
									Trip dùng tuyến trekking có sẵn. Điểm bắt đầu và kết thúc sẽ tự lấy từ tuyến bạn
									chọn.
								</p>
							</div>
						</div>
						{!isRouteLoading && !routeError && !hasActiveRoutes && onCreateRoute && (
							<button
								type="button"
								onClick={onCreateRoute}
								className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-bold text-white"
							>
								Tạo tuyến trekking
								<ArrowRight className="size-4" />
							</button>
						)}
					</div>
					<div className="p-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
							<label className="flex-1 text-sm font-bold text-[#34483b]">
								Tuyến đã duyệt
								<select
									aria-label="Tuyến đã duyệt"
									disabled={routeSelectDisabled}
									className={inputClass}
									{...register("routeId")}
								>
									<option value="">
										{isRouteLoading ? "Đang tải tuyến..." : "Chọn tuyến đã duyệt"}
									</option>
									{activeRoutes.map((route) => (
										<option key={route.id} value={route.id}>
											{route.name}
										</option>
									))}
								</select>
								{errors.routeId && (
									<span className="mt-1 block text-xs text-red-600">{errors.routeId.message}</span>
								)}
							</label>
							<button
								type="button"
								onClick={onRetryRoutes}
								disabled={isRouteLoading}
								className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cbd9ce] px-3 py-2.5 text-sm font-bold text-[#164027] disabled:opacity-60"
							>
								<RefreshCw className={`size-4 ${isRouteLoading ? "animate-spin" : ""}`} />
								Tải lại tuyến
							</button>
						</div>
					</div>
				</div>
				{routeError && (
					<p
						role="alert"
						className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
					>
						{routeError}
					</p>
				)}
				{!isRouteLoading && !routeError && !hasActiveRoutes && (
					<p
						role="alert"
						className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
					>
						Chưa có tuyến trekking đã duyệt. Form vẫn cho nhập nháp; nút tạo trip sẽ mở sau khi có
						tuyến phù hợp.
					</p>
				)}
			</section>

			<input type="hidden" {...register("meetingLongitude")} />
			<input type="hidden" {...register("meetingLatitude")} />
			<input type="hidden" {...register("waypoints.0.type")} />
			<input type="hidden" {...register("waypoints.0.name")} />
			<input type="hidden" {...register("waypoints.0.longitude")} />
			<input type="hidden" {...register("waypoints.0.latitude")} />
			<input type="hidden" {...register("waypoints.0.dayNumber")} />
			<input type="hidden" {...register("waypoints.0.sequenceOrder")} />
			<input type="hidden" {...register("waypoints.0.plannedAt")} />
			<input type="hidden" {...register("waypoints.1.type")} />
			<input type="hidden" {...register("waypoints.1.name")} />
			<input type="hidden" {...register("waypoints.1.longitude")} />
			<input type="hidden" {...register("waypoints.1.latitude")} />
			<input type="hidden" {...register("waypoints.1.dayNumber")} />
			<input type="hidden" {...register("waypoints.1.sequenceOrder")} />
			<input type="hidden" {...register("waypoints.1.plannedAt")} />

			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<h2 className="font-extrabold text-[#10221b]">Thông tin trip</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					<label className="text-sm font-bold text-[#34483b]">
						Tên trip
						<input
							aria-label="Tên trip"
							disabled={isSubmitting}
							maxLength={150}
							className={inputClass}
							{...register("title")}
						/>
						{errors.title && (
							<span className="mt-1 block text-xs text-red-600">{errors.title.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Loại trip
						<select
							aria-label="Loại trip"
							disabled={isSubmitting}
							className={inputClass}
							{...register("tripType")}
						>
							<option value="day_trip">Trong ngày</option>
							<option value="overnight">Qua đêm</option>
						</select>
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Bắt đầu
						<input
							aria-label="Bắt đầu"
							type="datetime-local"
							min={minDateTime}
							disabled={isSubmitting}
							className={inputClass}
							{...register("startsAt")}
						/>
						{errors.startsAt && (
							<span className="mt-1 block text-xs text-red-600">{errors.startsAt.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Kết thúc
						<input
							aria-label="Kết thúc"
							type="datetime-local"
							min={startsAt || minDateTime}
							disabled={isSubmitting}
							className={inputClass}
							{...register("endsAt")}
						/>
						{endsAtErrorMessage && (
							<span className="mt-1 block text-xs text-red-600">{endsAtErrorMessage}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Thời gian tập trung
						<input
							aria-label="Thời gian tập trung"
							type="datetime-local"
							min={minDateTime}
							max={startsAt || undefined}
							disabled={isSubmitting}
							className={inputClass}
							{...register("meetingAt")}
						/>
						{errors.meetingAt && (
							<span className="mt-1 block text-xs text-red-600">{errors.meetingAt.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Hạn đặt chỗ
						<input
							aria-label="Hạn đặt chỗ"
							type="datetime-local"
							min={minDateTime}
							max={startsAt || undefined}
							disabled={isSubmitting}
							className={inputClass}
							{...register("bookingDeadline")}
						/>
						{errors.bookingDeadline && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.bookingDeadline.message}
							</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Số khách tối thiểu
						<input
							aria-label="Số khách tối thiểu"
							inputMode="numeric"
							disabled={isSubmitting}
							className={inputClass}
							{...register("capacityMin")}
						/>
						{errors.capacityMin && (
							<span className="mt-1 block text-xs text-red-600">{errors.capacityMin.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Số khách tối đa
						<input
							aria-label="Số khách tối đa"
							inputMode="numeric"
							placeholder="Không giới hạn"
							disabled={isSubmitting}
							className={inputClass}
							{...register("capacityMax")}
						/>
						{errors.capacityMax && (
							<span className="mt-1 block text-xs text-red-600">{errors.capacityMax.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Giá mỗi người
						<input
							aria-label="Giá mỗi người"
							inputMode="decimal"
							disabled={isSubmitting}
							className={inputClass}
							{...register("pricePerPerson")}
						/>
						{errors.pricePerPerson && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.pricePerPerson.message}
							</span>
						)}
					</label>
					<div className="text-sm font-bold text-[#34483b]">
						<span>Ảnh bìa</span>
						<input type="hidden" {...register("coverImageUrl")} />
						<div className="mt-1 rounded-xl border border-dashed border-[#cbd9ce] bg-[#fbfdfb] p-3">
							{coverImagePreview ? (
								<div className="relative overflow-hidden rounded-lg">
									<img
										src={coverImagePreview}
										alt="Ảnh bìa đã chọn"
										className="h-28 w-full object-cover"
									/>
									<button
										type="button"
										aria-label="Bỏ ảnh bìa"
										onClick={clearCoverImage}
										disabled={isSubmitting}
										className="absolute top-2 right-2 rounded-full bg-white p-1.5 text-[#164027] shadow"
									>
										<X className="size-4" />
									</button>
								</div>
							) : (
								<label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-3 py-5 text-sm font-bold text-[#164027] ring-1 ring-[#dce8dd]">
									<ImagePlus className="size-4" />
									Chọn ảnh từ máy
									<input
										aria-label="Ảnh bìa"
										type="file"
										accept="image/*"
										disabled={isSubmitting}
										onChange={handleCoverImageChange}
										className="sr-only"
									/>
								</label>
							)}
							<p className="mt-2 text-xs font-medium text-[#667a6d]">
								Hỗ trợ JPG, PNG hoặc WebP, tối đa 5 MB.
							</p>
						</div>
						{errors.coverImageUrl && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.coverImageUrl.message}
							</span>
						)}
					</div>
					<label className="text-sm font-bold text-[#34483b] sm:col-span-2">
						Mô tả
						<textarea
							aria-label="Mô tả"
							disabled={isSubmitting}
							rows={3}
							className={inputClass}
							{...register("description")}
						/>
					</label>
				</div>
			</section>

			<TripRouteMap
				route={selectedRoute}
				meetingPoint={meetingPoint}
				disabled={isSubmitting}
				onMeetingPointChange={setMeetingPoint}
			/>

			{(errors.meetingLongitude || errors.meetingLatitude || errors.waypoints?.root) && (
				<p role="alert" className="text-sm font-bold text-red-600">
					{errors.meetingLongitude?.message ??
						errors.meetingLatitude?.message ??
						errors.waypoints?.root?.message ??
						"Vui lòng kiểm tra các điểm trên tuyến."}
				</p>
			)}

			{error && (
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
			)}

			<button
				type="submit"
				disabled={submitDisabled}
				className="flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-5 py-3 font-bold text-white disabled:opacity-60"
			>
				{isSubmitting && <Loader2 className="size-4 animate-spin" />}
				{isSubmitting
					? "Đang tạo trip..."
					: hasActiveRoutes
						? "Tạo trip draft"
						: "Cần tuyến đã duyệt để tạo trip"}
			</button>
		</form>
	);
}
