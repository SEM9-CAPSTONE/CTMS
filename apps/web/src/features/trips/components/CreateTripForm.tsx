import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, Loader2, RefreshCw, Route } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { CreatedTrekkingRoute } from "../../trekking-routes/types";
import type { CreateTripError } from "../hooks/useCreateTrip";
import {
	CREATE_TRIP_DEFAULT_VALUES,
	type CreateTripFormValues,
	createTripFormSchema,
	toCreateTripInput,
} from "../schema/create-trip.schema";
import type { CreateTripInput } from "../types";

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

const backendFieldMap: Record<string, keyof CreateTripFormValues> = {
	endsAt: "endsAt",
	bookingDeadline: "bookingDeadline",
	meetingAt: "meetingAt",
	capacityMin: "capacityMin",
	waypoints: "waypoints",
};

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
		control,
		handleSubmit,
		setError,
		setValue,
		watch,
		formState: { errors },
	} = useForm<CreateTripFormValues>({
		resolver: zodResolver(createTripFormSchema),
		defaultValues: CREATE_TRIP_DEFAULT_VALUES,
	});
	const { fields } = useFieldArray({ control, name: "waypoints" });
	const selectedRouteId = watch("routeId");
	const hasActiveRoutes = activeRoutes.length > 0;
	const routeSelectDisabled = isSubmitting || isRouteLoading || !hasActiveRoutes;
	const submitDisabled = isSubmitting || !hasActiveRoutes || !selectedRouteId;

	useEffect(() => {
		if (!hasActiveRoutes || selectedRouteId) return;
		setValue("routeId", activeRoutes[0].id, { shouldValidate: true });
	}, [activeRoutes, hasActiveRoutes, selectedRouteId, setValue]);

	useEffect(() => {
		if (!error) return;
		for (const [field, message] of Object.entries(error.fieldErrors)) {
			const mapped = backendFieldMap[field];
			if (mapped) setError(mapped, { message });
		}
	}, [error, setError]);

	return (
		<form
			className="grid gap-5"
			onSubmit={handleSubmit((values) => onSubmit(toCreateTripInput(values)))}
		>
			<section className="overflow-hidden rounded-2xl border border-[#dce8dd] bg-white shadow-sm">
				<div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
					<div className="bg-[#f7faf6] p-5">
						<div className="flex items-start gap-3">
							<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#164027]">
								<Route className="size-5" />
							</div>
							<div>
								<p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#728578]">
									CTMS-10 required
								</p>
								<h2 className="mt-1 text-lg font-extrabold text-[#10221b]">
									Chọn tuyến active trước khi submit
								</h2>
								<p className="mt-2 text-sm leading-6 text-[#667a6d]">
									Bạn vẫn có thể nhập trước thông tin trip. Backend chỉ nhận tạo draft khi tuyến đã
									active và thuộc Host hiện tại.
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
								Tuyến active
								<select
									aria-label="Tuyến active"
									disabled={routeSelectDisabled}
									className={inputClass}
									{...register("routeId")}
								>
									<option value="">
										{isRouteLoading ? "Đang tải tuyến..." : "Chọn tuyến active"}
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
						Chưa có tuyến active từ CTMS-10. Form vẫn cho nhập nháp; nút tạo trip sẽ mở sau khi có
						tuyến active.
					</p>
				)}
			</section>

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
							disabled={isSubmitting}
							className={inputClass}
							{...register("endsAt")}
						/>
						{errors.endsAt && (
							<span className="mt-1 block text-xs text-red-600">{errors.endsAt.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Thời gian tập trung
						<input
							aria-label="Thời gian tập trung"
							type="datetime-local"
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
					<label className="text-sm font-bold text-[#34483b]">
						URL ảnh bìa
						<input
							aria-label="URL ảnh bìa"
							disabled={isSubmitting}
							className={inputClass}
							{...register("coverImageUrl")}
						/>
						{errors.coverImageUrl && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.coverImageUrl.message}
							</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Kinh độ điểm tập trung
						<input
							aria-label="Kinh độ điểm tập trung"
							disabled={isSubmitting}
							className={inputClass}
							{...register("meetingLongitude")}
						/>
						{errors.meetingLongitude && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.meetingLongitude.message}
							</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Vĩ độ điểm tập trung
						<input
							aria-label="Vĩ độ điểm tập trung"
							disabled={isSubmitting}
							className={inputClass}
							{...register("meetingLatitude")}
						/>
						{errors.meetingLatitude && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.meetingLatitude.message}
							</span>
						)}
					</label>
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

			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<h2 className="font-extrabold text-[#10221b]">Waypoint bắt buộc</h2>
				<p className="mt-1 text-sm text-[#667a6d]">
					Draft trip cần waypoint bắt đầu và kết thúc trước khi qua CTMS-22.
				</p>
				<div className="mt-4 grid gap-4 lg:grid-cols-2">
					{fields.map((field, index) => (
						<div key={field.id} className="rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-4">
							<p className="text-sm font-extrabold text-[#10221b]">
								{index === 0 ? "Điểm bắt đầu" : "Điểm kết thúc"}
							</p>
							<input type="hidden" {...register(`waypoints.${index}.type`)} />
							<div className="mt-3 grid gap-3 sm:grid-cols-2">
								<label className="text-sm font-bold text-[#34483b] sm:col-span-2">
									Tên waypoint
									<input
										aria-label={`Tên waypoint ${index + 1}`}
										disabled={isSubmitting}
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
										disabled={isSubmitting}
										className={inputClass}
										{...register(`waypoints.${index}.longitude`)}
									/>
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Vĩ độ
									<input
										aria-label={`Vĩ độ waypoint ${index + 1}`}
										disabled={isSubmitting}
										className={inputClass}
										{...register(`waypoints.${index}.latitude`)}
									/>
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Ngày
									<input
										aria-label={`Ngày waypoint ${index + 1}`}
										disabled={isSubmitting}
										className={inputClass}
										{...register(`waypoints.${index}.dayNumber`)}
									/>
								</label>
								<label className="text-sm font-bold text-[#34483b]">
									Thứ tự
									<input
										aria-label={`Thứ tự waypoint ${index + 1}`}
										disabled={isSubmitting}
										className={inputClass}
										{...register(`waypoints.${index}.sequenceOrder`)}
									/>
									{errors.waypoints?.[index]?.sequenceOrder && (
										<span className="mt-1 block text-xs text-red-600">
											{errors.waypoints[index]?.sequenceOrder?.message}
										</span>
									)}
								</label>
								<label className="text-sm font-bold text-[#34483b] sm:col-span-2">
									Thời gian dự kiến
									<input
										aria-label={`Thời gian waypoint ${index + 1}`}
										type="datetime-local"
										disabled={isSubmitting}
										className={inputClass}
										{...register(`waypoints.${index}.plannedAt`)}
									/>
									{errors.waypoints?.[index]?.plannedAt && (
										<span className="mt-1 block text-xs text-red-600">
											{errors.waypoints[index]?.plannedAt?.message}
										</span>
									)}
								</label>
							</div>
						</div>
					))}
				</div>
				{errors.waypoints?.root?.message && (
					<p role="alert" className="mt-3 text-sm font-bold text-red-600">
						{errors.waypoints.root.message}
					</p>
				)}
			</section>

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
						: "Cần tuyến active để tạo trip"}
			</button>
		</form>
	);
}
