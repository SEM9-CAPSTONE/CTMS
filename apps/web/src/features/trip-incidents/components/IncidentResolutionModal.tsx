import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "../../../shared/components/Modal";
import { toast } from "../../../shared/components/Toast";
import { incidentStatusLabels } from "../constants";
import { type TripIncidentsApi, tripIncidentsService } from "../services/trip-incidents.service";
import type { IncidentAction, IncidentListItem, IncidentStatus } from "../types";
import { IncidentAuditTimeline } from "./IncidentAuditTimeline";
import { IncidentOverviewSection } from "./IncidentOverviewSection";
import { IncidentStatusForm } from "./IncidentStatusForm";

export interface IncidentResolutionModalProps {
	isOpen: boolean;
	onClose: () => void;
	incident: IncidentListItem | null;
	tripId: string;
	onIncidentUpdated: (updated?: IncidentListItem) => Promise<void> | void;
	api?: TripIncidentsApi;
}

const DEFAULT_NEXT_STATUS: Record<IncidentStatus, IncidentStatus> = {
	open: "investigating",
	investigating: "resolved",
	resolved: "closed",
	closed: "closed",
};

export function IncidentResolutionModal({
	isOpen,
	onClose,
	incident,
	tripId,
	onIncidentUpdated,
	api = tripIncidentsService,
}: IncidentResolutionModalProps) {
	const [activeIncident, setActiveIncident] = useState<IncidentListItem | null>(incident);
	const currentStatus = activeIncident?.status ?? incident?.status ?? "open";

	const [targetStatus, setTargetStatus] = useState<IncidentStatus>(
		DEFAULT_NEXT_STATUS[currentStatus] ?? "open"
	);
	const [actionNote, setActionNote] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const [history, setHistory] = useState<IncidentAction[]>([]);
	const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

	const loadHistory = useCallback(async () => {
		const targetId = activeIncident?.id ?? incident?.id;
		if (!targetId) return;
		setIsLoadingHistory(true);
		try {
			const res = await api.listHistory(tripId, targetId);
			setHistory(res.items);
		} catch {
			// Non-blocking history fetch
		} finally {
			setIsLoadingHistory(false);
		}
	}, [api, tripId, activeIncident?.id, incident?.id]);

	useEffect(() => {
		if (isOpen && incident) {
			setActiveIncident(incident);
			setTargetStatus(DEFAULT_NEXT_STATUS[incident.status] ?? "open");
			setActionNote("");
			setErrorMessage(null);
			void loadHistory();
		}
	}, [isOpen, incident, loadHistory]);

	if (!incident || !activeIncident) return null;

	const handleStatusUpdate = async () => {
		if (!targetStatus || targetStatus === currentStatus || currentStatus === "closed") return;
		setIsSubmitting(true);
		setErrorMessage(null);
		try {
			const res = await api.updateStatus(tripId, activeIncident.id, {
				status: targetStatus,
				note: actionNote.trim() || undefined,
			});
			const nextStatus = (res?.status ?? targetStatus) as IncidentStatus;
			const updatedIncident: IncidentListItem = { ...activeIncident, status: nextStatus };
			toast.success(`Đã chuyển trạng thái sang "${incidentStatusLabels[nextStatus]}"`);
			onClose();
			await onIncidentUpdated(updatedIncident);
		} catch (err: unknown) {
			let msg = "Không thể cập nhật trạng thái.";
			if (err instanceof Error) {
				if (err.message.includes("Cannot transition incident status")) {
					msg = "Không thể chuyển sang trạng thái này.";
				} else {
					msg = err.message;
				}
			}
			setErrorMessage(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Xử lý sự cố"
			size="lg"
			isCloseDisabled={isSubmitting}
		>
			<div className="space-y-4 p-5 text-sm text-[#10221b]">
				<IncidentOverviewSection incident={activeIncident} />

				{errorMessage && (
					<div
						role="alert"
						className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
					>
						<AlertCircle className="mt-0.5 size-4 shrink-0" />
						<span>{errorMessage}</span>
					</div>
				)}

				<div className="rounded-xl border border-slate-200 p-4">
					<IncidentStatusForm
						currentStatus={currentStatus}
						targetStatus={targetStatus}
						actionNote={actionNote}
						onActionNoteChange={setActionNote}
						isSubmitting={isSubmitting}
						onTargetStatusChange={setTargetStatus}
						onSubmit={handleStatusUpdate}
					/>
				</div>

				<IncidentAuditTimeline history={history} isLoading={isLoadingHistory} />
			</div>
		</Modal>
	);
}
