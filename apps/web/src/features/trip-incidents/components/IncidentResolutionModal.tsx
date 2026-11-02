import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "../../../shared/components/Modal";
import { incidentStatusLabels } from "../constants";
import { type TripIncidentsApi, tripIncidentsService } from "../services/trip-incidents.service";
import type { IncidentAction, IncidentListItem, IncidentStatus } from "../types";
import { IncidentAssigneeForm } from "./IncidentAssigneeForm";
import { IncidentAuditTimeline } from "./IncidentAuditTimeline";
import { IncidentOverviewSection } from "./IncidentOverviewSection";
import { IncidentStatusForm } from "./IncidentStatusForm";

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
				<IncidentOverviewSection incident={incident} />

				{errorMessage && (
					<div
						role="alert"
						className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
					>
						<AlertCircle className="mt-0.5 size-4 shrink-0" />
						<span>{errorMessage}</span>
					</div>
				)}

				{successMessage && (
					<output className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
						<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
						<span>{successMessage}</span>
					</output>
				)}

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<IncidentStatusForm
						currentStatus={currentStatus}
						targetStatus={targetStatus}
						availableStatuses={availableStatuses}
						isSubmitting={isSubmitting}
						onTargetStatusChange={setTargetStatus}
						onSubmit={handleStatusUpdate}
					/>

					<IncidentAssigneeForm
						assigneeId={assigneeId}
						currentAssignedTo={incident.assignedTo ?? null}
						isSubmitting={isSubmitting}
						onAssigneeIdChange={setAssigneeId}
						onAssign={handleAssign}
					/>
				</div>

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

				<IncidentAuditTimeline history={history} isLoading={isLoadingHistory} />
			</div>
		</Modal>
	);
}
