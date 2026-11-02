import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "../../../shared/components/Modal";
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

	const [targetStatus, setTargetStatus] = useState<IncidentStatus>(
		ALLOWED_TRANSITIONS[currentStatus]?.[0] ?? currentStatus
	);
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
			setSuccessMessage(`Đã chuyển trạng thái sang: ${incidentStatusLabels[targetStatus]}`);
			setActionNote("");
			await onIncidentUpdated();
			await loadHistory();
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

				<div className="rounded-xl border border-slate-200 p-4 space-y-3">
					<IncidentStatusForm
						currentStatus={currentStatus}
						targetStatus={targetStatus}
						isSubmitting={isSubmitting}
						onTargetStatusChange={setTargetStatus}
						onSubmit={handleStatusUpdate}
					/>

					{currentStatus !== "closed" && (
						<div>
							<label
								htmlFor="incident-action-note"
								className="block text-xs font-bold text-[#44594c]"
							>
								Ghi chú
							</label>
							<textarea
								id="incident-action-note"
								rows={2}
								value={actionNote}
								onChange={(e) => setActionNote(e.target.value)}
								maxLength={2000}
								placeholder="Nhập ghi chú (tùy chọn)..."
								disabled={isSubmitting}
								className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-[#164027] focus:outline-none"
							/>
						</div>
					)}
				</div>

				<IncidentAuditTimeline history={history} isLoading={isLoadingHistory} />
			</div>
		</Modal>
	);
}
