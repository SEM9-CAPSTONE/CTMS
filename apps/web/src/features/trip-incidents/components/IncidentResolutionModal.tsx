import { AlertCircle, CheckCircle2, History, Loader2, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { Modal } from "../../../shared/components/Modal";
import {
	incidentActionLabels,
	incidentCategoryLabels,
	incidentLocationNotes,
	incidentSeverityLabels,
	incidentSeverityStyles,
	incidentStatusLabels,
	incidentStatusStyles,
} from "../constants";
import { type TripIncidentsApi, tripIncidentsService } from "../services/trip-incidents.service";
import type { IncidentAction, IncidentListItem, IncidentStatus } from "../types";

export interface IncidentResolutionModalProps {
	isOpen: boolean;
	onClose: () => void;
	incident: IncidentListItem | null;
	tripId: string;
	onIncidentUpdated: () => Promise<void> | void;
	api?: TripIncidentsApi;
}

const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
	open: ["investigating", "resolved", "closed"],
	investigating: ["open", "resolved", "closed"],
	resolved: ["investigating", "closed"],
	closed: [],
};

export function IncidentResolutionModal({
	isOpen,
	onClose,
	incident,
	tripId,
	onIncidentUpdated,
	api = tripIncidentsService,
}: IncidentResolutionModalProps) {
	const currentStatus = incident?.status ?? "open";
	const availableStatuses = useMemo(
		() => ALLOWED_TRANSITIONS[currentStatus] ?? [],
		[currentStatus]
	);

	const [targetStatus, setTargetStatus] = useState<IncidentStatus>(
		availableStatuses[0] ?? currentStatus
	);
	const [assigneeId, setAssigneeId] = useState<string>(incident?.assignedTo ?? "");
	const [actionNote, setActionNote] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const [history, setHistory] = useState<IncidentAction[]>([]);
	const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

	const loadHistory = useCallback(async () => {
		if (!incident) return;
		setIsLoadingHistory(true);
		try {
			const res = await api.listHistory(tripId, incident.id);
			setHistory(res.items);
		} catch {
			// Non-blocking history fetch
		} finally {
			setIsLoadingHistory(false);
		}
	}, [api, tripId, incident]);

	useEffect(() => {
		if (isOpen && incident) {
			setTargetStatus(ALLOWED_TRANSITIONS[incident.status]?.[0] ?? incident.status);
			setAssigneeId(incident.assignedTo ?? "");
			setActionNote("");
			setErrorMessage(null);
			setSuccessMessage(null);
			void loadHistory();
		}
	}, [isOpen, incident, loadHistory]);

	if (!incident) return null;

	const handleStatusUpdate = async () => {
		if (!targetStatus || targetStatus === currentStatus) return;
		setIsSubmitting(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			await api.updateStatus(tripId, incident.id, {
				status: targetStatus,
				note: actionNote.trim() || undefined,
			});
			setSuccessMessage(`Đã cập nhật trạng thái sự cố sang: ${incidentStatusLabels[targetStatus]}`);
			setActionNote("");
			await onIncidentUpdated();
			await loadHistory();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Không thể cập nhật trạng thái sự cố.";
			setErrorMessage(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleAssign = async (assignTo: string | null) => {
		setIsSubmitting(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			await api.assign(tripId, incident.id, {
				assignedTo: assignTo,
				note: actionNote.trim() || undefined,
			});
			setSuccessMessage(
				assignTo ? "Đã phân công người xử lý sự cố." : "Đã hủy phân công người xử lý sự cố."
			);
			setActionNote("");
			await onIncidentUpdated();
			await loadHistory();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Không thể phân công xử lý.";
			setErrorMessage(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Quản lý sự cố chuyến đi"
			size="xl"
			isCloseDisabled={isSubmitting}
		>
			<div className="space-y-5 p-5 text-sm text-[#10221b]">
				{/* Incident Overview Card */}
				<section className="rounded-xl border border-[#e2ece2] bg-[#f9fbf9] p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex flex-wrap items-center gap-2">
							<span className="font-extrabold text-[#10221b]">
								{incidentCategoryLabels[incident.category]}
							</span>
							<span
								className={`rounded-full px-2 py-0.5 text-xs font-bold ${incidentSeverityStyles[incident.severity]}`}
							>
								{incidentSeverityLabels[incident.severity]}
							</span>
							<span
								className={`rounded-full border px-2 py-0.5 text-xs font-bold ${incidentStatusStyles[incident.status]}`}
							>
								{incidentStatusLabels[incident.status]}
							</span>
						</div>
						<span className="text-xs text-[#667a6d]">
							Thời điểm: {new Date(incident.occurredAt).toLocaleString("vi-VN")}
						</span>
					</div>

					<p className="mt-2 text-sm text-[#33463a]">{incident.description}</p>

					<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#667a6d]">
						{incident.reporterName && <span>Người báo cáo: {incident.reporterName}</span>}
						{incident.assignedToName ? (
							<span className="font-semibold text-emerald-800">
								Người xử lý: {incident.assignedToName}
							</span>
						) : (
							<span className="italic text-slate-500">Chưa có người xử lý</span>
						)}
						{incident.location && (
							<span>
								Tọa độ: {incident.location.latitude.toFixed(5)},{" "}
								{incident.location.longitude.toFixed(5)}
								{incident.locationStatus && incidentLocationNotes[incident.locationStatus] && (
									<> · {incidentLocationNotes[incident.locationStatus]}</>
								)}
							</span>
						)}
					</div>
				</section>

				{/* Feedback alerts */}
				{errorMessage && (
					<div
						role="alert"
						className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
					>
						<AlertCircle className="size-4 shrink-0 mt-0.5" />
						<span>{errorMessage}</span>
					</div>
				)}

				{successMessage && (
					<output className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
						<CheckCircle2 className="size-4 shrink-0 mt-0.5" />
						<span>{successMessage}</span>
					</output>
				)}

				{/* Operations grid */}
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					{/* Status Update Box */}
					<div className="rounded-xl border border-slate-200 p-4">
						<h3 className="font-extrabold text-[#10221b]">Cập nhật trạng thái</h3>
						{availableStatuses.length > 0 ? (
							<div className="mt-3 space-y-3">
								<div>
									<label
										htmlFor="incident-next-status"
										className="block text-xs font-bold text-[#44594c]"
									>
										Trạng thái tiếp theo
									</label>
									<select
										id="incident-next-status"
										value={targetStatus}
										onChange={(e) => setTargetStatus(e.target.value as IncidentStatus)}
										disabled={isSubmitting}
										className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-[#164027] focus:outline-none"
									>
										{availableStatuses.map((st) => (
											<option key={st} value={st}>
												{incidentStatusLabels[st]}
											</option>
										))}
									</select>
								</div>

								<Button
									size="sm"
									disabled={isSubmitting || targetStatus === currentStatus}
									onClick={handleStatusUpdate}
									className="w-full"
								>
									{isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
									<span>Chuyển sang &quot;{incidentStatusLabels[targetStatus]}&quot;</span>
								</Button>
							</div>
						) : (
							<p className="mt-3 text-xs italic text-slate-500">
								Sự cố đã ở trạng thái kết thúc ({incidentStatusLabels[currentStatus]}). Không thể
								chuyển trạng thái.
							</p>
						)}
					</div>

					{/* Assignment Box */}
					<div className="rounded-xl border border-slate-200 p-4">
						<h3 className="font-extrabold text-[#10221b]">Phân công xử lý</h3>
						<div className="mt-3 space-y-3">
							<div>
								<label
									htmlFor="incident-assignee-id"
									className="block text-xs font-bold text-[#44594c]"
								>
									Mã người xử lý (User ID)
								</label>
								<input
									id="incident-assignee-id"
									type="text"
									value={assigneeId}
									onChange={(e) => setAssigneeId(e.target.value)}
									placeholder="UUID người phụ trách..."
									disabled={isSubmitting}
									className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-[#164027] focus:outline-none"
								/>
							</div>

							<div className="flex gap-2">
								<Button
									size="sm"
									disabled={isSubmitting || !assigneeId.trim()}
									onClick={() => handleAssign(assigneeId.trim())}
									className="flex-1"
								>
									<UserCheck className="size-3.5 mr-1" />
									<span>Phân công</span>
								</Button>
								{incident.assignedTo && (
									<Button
										size="sm"
										variant="outline"
										disabled={isSubmitting}
										onClick={() => {
											setAssigneeId("");
											void handleAssign(null);
										}}
									>
										<UserX className="size-3.5 mr-1" />
										<span>Hủy</span>
									</Button>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Action Note */}
				<div>
					<label htmlFor="incident-action-note" className="block text-xs font-bold text-[#44594c]">
						Ghi chú xử lý / Biên bản hành động
					</label>
					<textarea
						id="incident-action-note"
						rows={2}
						value={actionNote}
						onChange={(e) => setActionNote(e.target.value)}
						maxLength={2000}
						placeholder="Nhập ghi chú hoặc mô tả hành động xử lý (tùy chọn)..."
						disabled={isSubmitting}
						className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-[#164027] focus:outline-none"
					/>
				</div>

				{/* Audit Action History (PB AC-4, BR-269) */}
				<section className="border-t border-slate-200 pt-4">
					<div className="flex items-center gap-1.5 font-extrabold text-[#10221b]">
						<History className="size-4" />
						<span>Lịch sử xử lý sự cố (Audit History)</span>
					</div>

					{isLoadingHistory ? (
						<div className="mt-3 flex items-center justify-center p-4 text-xs text-[#667a6d]">
							<Loader2 className="size-4 animate-spin mr-2" />
							<span>Đang tải lịch sử...</span>
						</div>
					) : history.length === 0 ? (
						<p className="mt-2 text-xs italic text-slate-500">Chưa có hành động xử lý nào.</p>
					) : (
						<ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-[#fbfdfb]">
							{history.map((act) => (
								<li key={act.id} className="p-3 text-xs space-y-1">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<span className="font-bold text-[#164027]">
												{incidentActionLabels[act.action] ?? act.action}
											</span>
											{act.actorName && (
												<span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
													{act.actorName} ({act.actorRole ?? "user"})
												</span>
											)}
										</div>
										<span className="text-[11px] text-slate-400">
											{new Date(act.createdAt).toLocaleString("vi-VN")}
										</span>
									</div>

									{act.toStatus && act.fromStatus && (
										<p className="text-[#33463a]">
											Chuyển trạng thái:{" "}
											<span className="font-semibold text-slate-600">
												{incidentStatusLabels[act.fromStatus] ?? act.fromStatus}
											</span>{" "}
											→{" "}
											<span className="font-bold text-[#164027]">
												{incidentStatusLabels[act.toStatus] ?? act.toStatus}
											</span>
										</p>
									)}

									{act.note && (
										<p className="rounded bg-white p-2 text-slate-600 border border-slate-100 italic">
											&quot;{act.note}&quot;
										</p>
									)}
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</Modal>
	);
}
