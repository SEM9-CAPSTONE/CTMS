import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, CheckCircle2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { HttpError, queryKeys } from "../../../core/api";
import { toast } from "../../../shared/components/Toast";
import { useTrekkingRoutes } from "../../trekking-routes/hooks/useTrekkingRoutes";
import { ConfigureTripWaypointsPanel } from "../components/ConfigureTripWaypointsPanel";
import { CreateTripForm, type CreateTripFormHandle } from "../components/CreateTripForm";
import {
	PendingTripImageEditor,
	type PendingTripImages,
} from "../components/PendingTripImageEditor";
import { TripImageEditor } from "../components/TripImageEditor";
import { useCreateTrip } from "../hooks/useCreateTrip";
import { useTripDetail } from "../hooks/useTripDetail";
import { useTripDraftNavigation } from "../hooks/useTripDraftNavigation";
import { useTripDraftSession } from "../hooks/useTripDraftSession";
import { useTripFormAutosave } from "../hooks/useTripFormAutosave";
import { useTripFormDraft } from "../hooks/useTripFormDraft";
import { useUpdateTripDraft } from "../hooks/useUpdateTripDraft";
import {
	type ConfigureTripWaypointFormItem,
	toCreateTripWaypointInput,
} from "../schema/configure-trip-waypoints.schema";
import { type CreateTripFormValues, toCreateTripFormValues } from "../schema/create-trip.schema";
import { tripFormDraftsService } from "../services/trip-form-drafts.service";
import { tripsService } from "../services/trips.service";
import type { CreateTripInput, Trip } from "../types";
import { pendingTripPreview } from "../utils/pending-trip-update";
import type { DraftSnapshot } from "../utils/trip-draft-cache";
export interface CreateTripPageProps {
	onBackHome?: () => void;
	onCreateRoute?: () => void;
	onEditTripInfo?: (tripId: string) => void;
	editTripId?: string;
	formDraftId?: string;
}
export function CreateTripPage({
	onBackHome,
	onCreateRoute,
	onEditTripInfo,
	editTripId,
	formDraftId,
}: CreateTripPageProps) {
	const queryClient = useQueryClient();
	const [pendingPayload, setPendingPayload] = useState<CreateTripInput | null>(null);
	const [pendingBase, setPendingBase] = useState<Trip | null>(null);
	const [pendingPreview, setPendingPreview] = useState<Trip | null>(null);
	const [pendingImages, setPendingImages] = useState<PendingTripImages | null>(null);
	const [finalizing, setFinalizing] = useState(false);
	const finalizingRef = useRef(false);
	const creation = useCreateTrip();
	const updateDraft = useUpdateTripDraft(editTripId);
	const routes = useTrekkingRoutes();
	const isEditMode = Boolean(editTripId);
	const session = useTripDraftSession(formDraftId, !isEditMode);
	const formDraft = useTripFormDraft(session.remoteId);
	const linkedTripId =
		creation.pendingTrip?.id ??
		creation.createdTrip?.id ??
		session.restored?.tripId ??
		formDraft.draft?.tripId ??
		undefined;
	const draftDetail = useTripDetail(editTripId ?? linkedTripId);
	const draftForm = useRef<CreateTripFormHandle>(null);
	const snapshot = useRef<DraftSnapshot | null>(null);
	const signature = useRef<{ json: string; images: File[] } | null>(null);
	const [waypointTrip, setWaypointTrip] = useState<Trip | null>(null);
	const [draftError, setDraftError] = useState("");
	const [leaving, setLeaving] = useState(false);
	const [imageBusy, setImageBusy] = useState(false);
	const savedTrip =
		waypointTrip ??
		(updateDraft.updatedTrip?.status === "pending_approval" ? null : updateDraft.updatedTrip);
	const read = useCallback(() => draftForm.current?.getSnapshot() ?? snapshot.current, []);
	const autosave = useTripFormAutosave({
		session,
		enabled: !isEditMode && !savedTrip && session.ready,
		busy: creation.isSubmitting,
		linkedTripId,
		read,
		invalidate: formDraft.invalidate,
	});
	const onDraftChange = useCallback(
		(values: CreateTripFormValues, images: File[]) => {
			snapshot.current = { values, images };
			const json = JSON.stringify(values);
			if (signature.current?.json === json && signature.current.images === images) return;
			signature.current = { json, images };
			autosave.schedule({ values, images });
		},
		[autosave.schedule]
	);
	const activeRoutes = useMemo(
		() => routes.items.filter((route) => route.status === "active"),
		[routes.items]
	);
	const editableTrip = useMemo(
		() => (draftDetail.trip?.routeId ? (draftDetail.trip as Trip) : null),
		[draftDetail.trip]
	);
	const formDefaults = useMemo(
		() =>
			(pendingPreview ? toCreateTripFormValues(pendingPreview) : undefined) ??
			session.restored?.values ??
			formDraft.draft?.values ??
			(editableTrip ? toCreateTripFormValues(editableTrip) : undefined),
		[session.restored, formDraft.draft, editableTrip, pendingPreview]
	);
	const initialImages = session.restored?.images ?? formDraft.images;
	const finishTrip = useCallback(
		async (saved: Trip | null) => {
			if (!saved) return null;

			if (!isEditMode) {
				try {
					await tripFormDraftsService.complete(session.id, saved.id);
					await autosave.finish();
					void formDraft.invalidate();
				} catch {
					setDraftError(
						"Trip đã được tạo nhưng chưa cập nhật được bản nháp. Bấm Bước tiếp theo để thử lại."
					);
					autosave.resume();
					return null;
				}
			}
			setWaypointTrip(saved);
			return saved;
		},
		[isEditMode, session.id, autosave.finish, autosave.resume, formDraft.invalidate]
	);
	const submitTripInfo = useCallback(
		async (payload: CreateTripInput, images?: File[]) => {
			setDraftError("");
			if (isEditMode && editableTrip?.status === "pending_approval") {
				if (!pendingImages) {
					setDraftError("Chưa tải được ảnh chuyến đi. Vui lòng thử lại trước khi tiếp tục.");
					return null;
				}
				const preview = pendingTripPreview(pendingPreview ?? editableTrip, payload);
				setPendingBase((base) => base ?? editableTrip);
				setPendingPayload(payload);
				setPendingPreview(preview);
				setWaypointTrip(preview);
				return preview;
			}
			if (isEditMode) return finishTrip(await updateDraft.submit(payload));
			if (linkedTripId && !editableTrip && !creation.createdTrip) {
				setDraftError("Chưa tải được chuyến đi đã lưu. Vui lòng thử lại.");
				return null;
			}
			if (!(await autosave.flush(true))) return null;
			autosave.pause();
			const saved =
				creation.createdTrip ??
				(linkedTripId && editableTrip
					? await creation.submit(payload, images ?? [], editableTrip)
					: images?.length
						? await creation.submit(payload, images)
						: await creation.submit(payload));
			if (!saved) {
				autosave.resume();
				return null;
			}
			return finishTrip(saved);
		},
		[
			isEditMode,
			finishTrip,
			updateDraft.submit,
			pendingImages,
			pendingPreview,
			linkedTripId,
			editableTrip,
			autosave.flush,
			autosave.pause,
			autosave.resume,
			creation.createdTrip,
			creation.submit,
		]
	);
	const retry = useCallback(async () => {
		if (isEditMode) return finishTrip(await updateDraft.retry());
		if (!(await autosave.flush(true))) return null;
		autosave.pause();
		const saved = creation.createdTrip ?? (await creation.retry());
		if (!saved) {
			autosave.resume();
			return null;
		}
		return finishTrip(saved);
	}, [
		isEditMode,
		updateDraft.retry,
		autosave.flush,
		autosave.pause,
		autosave.resume,
		creation.createdTrip,
		creation.retry,
		finishTrip,
	]);
	const leave = useCallback(async () => {
		setLeaving(true);
		try {
			if (isEditMode || savedTrip || (await autosave.leave())) onBackHome?.();
		} finally {
			setLeaving(false);
		}
	}, [isEditMode, savedTrip, autosave.leave, onBackHome]);
	useTripDraftNavigation(!isEditMode && !savedTrip, autosave.leave);
	const stageTripChange = useCallback((trip: Trip) => {
		setPendingPreview(trip);
		setWaypointTrip(trip);
	}, []);
	const finalizePending = useCallback(
		async (items: ConfigureTripWaypointFormItem[]): Promise<Trip | null> => {
			if (
				finalizingRef.current ||
				!pendingPayload ||
				!pendingPreview ||
				!pendingImages ||
				!editableTrip
			)
				return null;
			finalizingRef.current = true;
			setFinalizing(true);
			setDraftError("");
			try {
				const originalIds = new Set((pendingBase ?? editableTrip).waypoints.map((w) => w.id));
				const waypoints = items.map((w) => ({
					...toCreateTripWaypointInput(w),
					...(originalIds.has(w.id) ? { id: w.id } : {}),
				}));
				const updated = await tripsService.finalizePendingUpdate(
					editableTrip.id,
					{
						...pendingPayload,
						waypoints,
						expectedUpdatedAt: pendingPreview.updatedAt,
						retainedImageIds: pendingImages.retained.map((i) => i.id),
					},
					pendingImages.files
				);
				queryClient.setQueryData(queryKeys.trips.images(updated.id), updated.images);
				void queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
				setPendingBase(updated);
				setPendingPreview(updated);
				setWaypointTrip(updated);
				setPendingImages({ retained: updated.images, files: [] });
				toast.success("Đã cập nhật chuyến đi.");
				return updated;
			} catch (error) {
				setDraftError(
					error instanceof HttpError && error.status === 409
						? "Chuyến đi đã thay đổi hoặc được admin xử lý. Hãy tải lại trước khi cập nhật; nội dung đang nhập vẫn được giữ lại."
						: "Chưa cập nhật được chuyến đi. Nội dung đang nhập vẫn được giữ lại, vui lòng thử lại."
				);
				return null;
			} finally {
				finalizingRef.current = false;
				setFinalizing(false);
			}
		},
		[pendingPayload, pendingPreview, pendingImages, editableTrip, queryClient, pendingBase]
	);
	const restoring = !session.ready || Boolean(session.remoteId && formDraft.isLoading);
	const restoreError = Boolean(
		(session.restoreError && !session.remoteId) || (session.remoteId && formDraft.error)
	);
	if (restoring || restoreError)
		return (
			<main className="p-8">
				{restoreError ? (
					<>
						<p role="alert">
							Không thể khôi phục bản nháp. Dữ liệu trên thiết bị vẫn được giữ lại.
						</p>
						<button
							type="button"
							onClick={() => (session.remoteId ? void formDraft.retry() : window.location.reload())}
						>
							Thử lại
						</button>
					</>
				) : (
					<output>Đang khôi phục bản nháp…</output>
				)}
			</main>
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
					<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-5 sm:px-6">
						{onEditTripInfo && (
							<button
								type="button"
								disabled={finalizing}
								aria-label="Quay lại bước 1"
								title="Quay lại bước 1"
								onClick={() => {
									setWaypointTrip(null);
									updateDraft.reset();
									// Editing an existing Trip keeps the same URL, so navigation
									// alone cannot leave step two or refresh its saved waypoints.
									if (!pendingPreview && editTripId === trip.id) void draftDetail.retry();
									onEditTripInfo(trip.id);
								}}
								className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#10221b] bg-white text-[#10221b] hover:bg-[#f4f7f2]"
							>
								<ArrowLeft className="size-5" aria-hidden="true" />
							</button>
						)}
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
					{draftError && (
						<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
							{draftError}
						</p>
					)}
					<ConfigureTripWaypointsPanel
						trip={trip}
						route={selectedRoute}
						onStageTripChange={pendingPayload ? stageTripChange : undefined}
						onFinalizeUpdate={pendingPayload ? finalizePending : undefined}
						isFinalizing={finalizing}
					/>
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
							onClick={() => void leave()}
							disabled={leaving || creation.isSubmitting || imageBusy}
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
							{formDraftId || session.restored
								? "Tiếp tục bản nháp"
								: isEditMode
									? "Thông tin chuyến đi"
									: "Tạo chuyến đi cho Host"}
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
				{draftError && (
					<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
						{draftError}
					</p>
				)}
				{!isEditMode && (
					<output
						className={`mb-4 block text-sm ${autosave.error ? "text-amber-700" : "text-[#667a6d]"}`}
						aria-live="polite"
					>
						{autosave.saving
							? "Đang tự lưu bản nháp…"
							: autosave.error ||
								(autosave.saved ? "Đã tự lưu bản nháp" : "Nội dung và ảnh sẽ được tự động lưu.")}
					</output>
				)}

				<CreateTripForm
					draftHandle={draftForm}
					activeRoutes={activeRoutes}
					isRouteLoading={routes.isLoading}
					routeError={routes.error}
					isSubmitting={
						leaving ||
						imageBusy ||
						Boolean(formDraft.draft?.tripId && draftDetail.isLoading) ||
						(isEditMode ? updateDraft.isSubmitting : creation.isSubmitting)
					}
					error={isEditMode ? updateDraft.error : creation.error}
					onSubmit={submitTripInfo}
					onDraftChange={onDraftChange}
					initialImages={initialImages}
					allowImages={!isEditMode}
					imageEditor={
						isEditMode && editTripId && editableTrip?.status === "pending_approval" ? (
							<PendingTripImageEditor
								tripId={editTripId}
								value={pendingImages}
								onChange={setPendingImages}
							/>
						) : isEditMode && editTripId ? (
							<TripImageEditor
								tripId={editTripId}
								disabled={leaving || updateDraft.isSubmitting}
								onBusyChange={setImageBusy}
							/>
						) : undefined
					}
					locked={!isEditMode && Boolean(creation.pendingTrip)}
					onRetry={retry}
					onRetryRoutes={routes.retry}
					onCreateRoute={onCreateRoute}
					defaultValues={formDefaults}
					draftStorageKey={isEditMode ? `ctms:trip-form-draft:${editTripId}` : undefined}
					submitLabel="Bước tiếp theo"
					submittingLabel={
						leaving ? "Đang lưu bản nháp..." : isEditMode ? "Đang cập nhật..." : "Đang tạo trip..."
					}
					title={isEditMode ? "Thông tin chuyến đi" : undefined}
				/>
			</main>
		</div>
	);
}
