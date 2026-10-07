import { ArrowLeft, CalendarPlus, CheckCircle2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTrekkingRoutes } from "../../trekking-routes/hooks/useTrekkingRoutes";
import { ConfigureTripWaypointsPanel } from "../components/ConfigureTripWaypointsPanel";
import { CreateTripForm } from "../components/CreateTripForm";
import { useCreateTrip } from "../hooks/useCreateTrip";
import { useTripDetail } from "../hooks/useTripDetail";
import { useUpdateTripDraft } from "../hooks/useUpdateTripDraft";
import { toCreateTripFormValues } from "../schema/create-trip.schema";
import type { CreateTripInput, Trip } from "../types";

export interface CreateTripPageProps {
	onBackHome?: () => void;
	onCreateRoute?: () => void;
	editTripId?: string;
}

export function CreateTripPage({ onBackHome, onCreateRoute, editTripId }: CreateTripPageProps) {
	const creation = useCreateTrip();
	const updateDraft = useUpdateTripDraft(editTripId);
	const draftDetail = useTripDetail(editTripId);
	const routes = useTrekkingRoutes();
	const isEditMode = Boolean(editTripId);
	const [waypointTrip, setWaypointTrip] = useState<Trip | null>(null);
	const submitCreateTrip = creation.submit;
	const submitUpdateDraft = updateDraft.submit;
	const activeRoutes = useMemo(
		() => routes.items.filter((route) => route.status === "active"),
		[routes.items]
	);
	const editableTrip = useMemo(() => {
		if (!draftDetail.trip?.routeId) return null;
		return draftDetail.trip as Trip;
	}, [draftDetail.trip]);
	const savedTrip = waypointTrip ?? updateDraft.updatedTrip ?? creation.createdTrip;
	const submitTripInfo = useCallback(
		async (payload: CreateTripInput) => {
			const saved = isEditMode ? await submitUpdateDraft(payload) : await submitCreateTrip(payload);
			if (saved) setWaypointTrip(saved);
			return saved;
		},
		[isEditMode, submitCreateTrip, submitUpdateDraft]
	);

	if (savedTrip) {
		const trip = savedTrip;
		const selectedRoute =
			routes.items.find((route) => route.id === trip.routeId) ??
			activeRoutes.find((route) => route.id === trip.routeId) ??
			null;
		return (
			<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
				<header className="border-b bg-white">
					<div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5 sm:px-6">
						<div className="rounded-xl bg-emerald-50 p-3 text-[#164027]">
							<CheckCircle2 className="size-6" />
						</div>
						<div>
							<p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#728578]">
								Bước 2 / 2
							</p>
							<h1 className="text-xl font-extrabold sm:text-2xl">Lịch trình chuyến đi</h1>
						</div>
					</div>
				</header>
				<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
					<ConfigureTripWaypointsPanel trip={trip} route={selectedRoute} />
				</main>
			</div>
		);
	}

	if (isEditMode && draftDetail.isLoading) {
		return (
			<div className="min-h-screen bg-[#f4f7f2] px-4 py-10 text-[#10221b]">
				<div className="mx-auto max-w-3xl rounded-2xl border border-[#dce8dd] bg-white p-6 shadow-sm">
					<p className="font-bold text-[#667a6d]">Đang tải bản chỉnh sửa...</p>
				</div>
			</div>
		);
	}

	if (isEditMode && (draftDetail.error || !editableTrip)) {
		return (
			<div className="min-h-screen bg-[#f4f7f2] px-4 py-10 text-[#10221b]">
				<div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
					<h1 className="text-lg font-extrabold">Không thể mở bản chỉnh sửa</h1>
					<p className="mt-2 text-sm text-red-700">
						{draftDetail.error ?? "Chuyến đi này không còn đủ dữ liệu để sửa."}
					</p>
					<button
						type="button"
						onClick={() => void draftDetail.retry()}
						className="mt-4 rounded-xl border border-[#cbd9ce] px-4 py-2.5 font-bold text-[#164027]"
					>
						Tải lại
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="border-b bg-white">
				<div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5 sm:px-6">
					{onBackHome && (
						<button
							type="button"
							aria-label="Quay về trang quản lý Host"
							onClick={onBackHome}
							className="rounded-xl border p-2.5"
						>
							<ArrowLeft className="size-5" />
						</button>
					)}
					<div className="rounded-xl bg-emerald-50 p-3 text-[#164027]">
						<CalendarPlus className="size-6" />
					</div>
					<div>
						<h1 className="text-xl font-extrabold sm:text-2xl">
							{isEditMode ? "Thông tin chuyến đi" : "Tạo chuyến đi cho Host"}
						</h1>
						<p className="text-sm text-[#667a6d]">
							{isEditMode
								? "Cập nhật thông tin chuyến đi."
								: "Tạo chuyến đi nháp từ tuyến trekking đã duyệt, điểm đầu/cuối được lấy theo tuyến có sẵn."}
						</p>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
				<CreateTripForm
					activeRoutes={activeRoutes}
					isRouteLoading={routes.isLoading}
					routeError={routes.error}
					isSubmitting={isEditMode ? updateDraft.isSubmitting : creation.isSubmitting}
					error={isEditMode ? updateDraft.error : creation.error}
					onSubmit={submitTripInfo}
					onRetry={isEditMode ? updateDraft.retry : creation.retry}
					onRetryRoutes={routes.retry}
					onCreateRoute={onCreateRoute}
					defaultValues={editableTrip ? toCreateTripFormValues(editableTrip) : undefined}
					draftStorageKey={
						isEditMode ? `ctms:trip-form-draft:${editTripId}` : "ctms:trip-form-draft:create"
					}
					submitLabel={isEditMode ? "Bước tiếp theo" : "Tạo bản nháp và cấu hình điểm dừng"}
					submittingLabel={isEditMode ? "Đang lưu chỉnh sửa..." : "Đang tạo trip..."}
					title={isEditMode ? "Thông tin chuyến đi" : undefined}
				/>
			</main>
		</div>
	);
}
