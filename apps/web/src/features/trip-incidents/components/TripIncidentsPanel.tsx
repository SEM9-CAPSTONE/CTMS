import { Loader2, Plus, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../shared/components/Button";
import type { TripStatus } from "../../trips/types";
import { type UseTripIncidentsOptions, useTripIncidents } from "../hooks/useTripIncidents";
import type { NewIncidentInput } from "../utils/incident-record";
import { IncidentCard } from "./IncidentCard";
import { ReportIncidentForm } from "./ReportIncidentForm";

export interface TripIncidentsPanelProps extends UseTripIncidentsOptions {
	tripId: string;
	tripStatus: TripStatus;
}

/** New incidents are accepted only while the Trip is running (AC1); old ones still sync. */
const REPORTABLE_TRIP_STATUS: TripStatus = "ongoing";

export function TripIncidentsPanel({ tripId, tripStatus, store, api }: TripIncidentsPanelProps) {
	const incidents = useTripIncidents(tripId, { store, api });
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const canReport = incidents.canReport && tripStatus === REPORTABLE_TRIP_STATUS;

	const handleSubmit = async (input: NewIncidentInput) => {
		await incidents.saveIncident(input);
		setIsFormOpen(false);
		// Saved locally only; the list badge switches to "synced" once the server confirms.
		setNotice(
			incidents.isOnline
				? "Đã lưu sự cố trên thiết bị và đang gửi lên máy chủ."
				: "Đã lưu sự cố trên thiết bị. Sự cố sẽ được gửi khi có kết nối."
		);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-extrabold text-[#10221b]">Sự cố đã báo cáo</h2>
				<span
					className={`inline-flex items-center gap-1 text-xs font-bold ${
						incidents.isOnline ? "text-[#2d5a27]" : "text-amber-800"
					}`}
				>
					{incidents.isOnline ? (
						<Wifi aria-hidden="true" className="size-4" />
					) : (
						<WifiOff aria-hidden="true" className="size-4" />
					)}
					<span>{incidents.isOnline ? "Trực tuyến" : "Ngoại tuyến"}</span>
				</span>
			</div>

			{incidents.unsentCount > 0 && (
				<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
					<span>{incidents.unsentCount} sự cố đang chờ đồng bộ với máy chủ.</span>
					{incidents.isOnline && (
						<Button size="sm" variant="outline" onClick={() => void incidents.syncNow()}>
							<RefreshCw aria-hidden="true" className="mr-1 size-3.5" />
							<span>Đồng bộ ngay</span>
						</Button>
					)}
				</div>
			)}

			{notice && (
				<output className="block rounded-xl bg-[#eef4ef] p-3 text-xs font-semibold text-[#2d5a27]">
					{notice}
				</output>
			)}

			{canReport && !isFormOpen && (
				<Button
					onClick={() => {
						setNotice(null);
						setIsFormOpen(true);
					}}
				>
					<Plus aria-hidden="true" className="mr-1 size-4" />
					<span>Báo cáo sự cố</span>
				</Button>
			)}
			{!canReport && (
				<p className="text-xs text-[#667a6d]">
					Chỉ có thể báo cáo sự cố mới khi chuyến đi đang diễn ra.
				</p>
			)}
			{isFormOpen && (
				<ReportIncidentForm
					isOnline={incidents.isOnline}
					onSubmit={handleSubmit}
					onCancel={() => setIsFormOpen(false)}
				/>
			)}

			{incidents.listError && (
				<p role="alert" className="text-xs font-semibold text-rose-800">
					{incidents.listError}
				</p>
			)}
			<IncidentList incidents={incidents} />
		</div>
	);
}

function IncidentList({ incidents }: { incidents: ReturnType<typeof useTripIncidents> }) {
	if (incidents.isLoading) {
		return (
			<p className="flex items-center gap-2 text-sm text-[#667a6d]">
				<Loader2 aria-hidden="true" className="size-4 animate-spin" />
				<span>Đang tải sự cố...</span>
			</p>
		);
	}
	if (incidents.items.length === 0) {
		return <p className="text-sm text-[#667a6d]">Chưa có sự cố nào được báo cáo.</p>;
	}
	return (
		<ul aria-label="Danh sách sự cố" className="space-y-3">
			{incidents.items.map((item) => (
				<IncidentCard
					key={item.id}
					item={item}
					onRetry={(id) => void incidents.retry(id)}
					onDiscard={(id) => void incidents.discard(id)}
					onDropPhoto={(id) => void incidents.dropPhoto(id)}
				/>
			))}
		</ul>
	);
}
