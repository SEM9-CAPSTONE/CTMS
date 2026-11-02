import { Loader2, Plus, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import type { TripStatus } from "../../trips/types";
import { type UseTripIncidentsOptions, useTripIncidents } from "../hooks/useTripIncidents";
import type { IncidentCategory, IncidentListItem } from "../types";
import type { NewIncidentInput } from "../utils/incident-record";
import { IncidentDetailModal } from "./IncidentDetailModal";
import { IncidentResolutionModal } from "./IncidentResolutionModal";
import { ReportIncidentForm } from "./ReportIncidentForm";
import { type IncidentStatusFilter, TripIncidentsFilterBar } from "./TripIncidentsFilterBar";
import { TripIncidentsTable } from "./TripIncidentsTable";

export interface TripIncidentsPanelProps extends UseTripIncidentsOptions {
	tripId: string;
	tripStatus: TripStatus;
	canManage?: boolean;
}

/** New incidents are accepted only while the Trip is running (AC1); old ones still sync. */
const REPORTABLE_TRIP_STATUS: TripStatus = "ongoing";

export function TripIncidentsPanel({
	tripId,
	tripStatus,
	canManage = false,
	store,
	api,
}: TripIncidentsPanelProps) {
	const incidents = useTripIncidents(tripId, { store, api });
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);

	// Filtering & Pagination State
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<IncidentStatusFilter>("all");
	const [categoryFilter, setCategoryFilter] = useState<"all" | IncidentCategory>("all");
	const [currentPage, setCurrentPage] = useState(1);

	// Modal States
	const [detailedIncident, setDetailedIncident] = useState<IncidentListItem | null>(null);
	const [resolvingIncident, setResolvingIncident] = useState<IncidentListItem | null>(null);

	const canReport = incidents.canReport && tripStatus === REPORTABLE_TRIP_STATUS;

	const handleSubmit = async (input: NewIncidentInput) => {
		await incidents.saveIncident(input);
		setIsFormOpen(false);
		setNotice(
			incidents.isOnline
				? "Đã lưu sự cố trên thiết bị và đang gửi lên máy chủ."
				: "Đã lưu sự cố trên thiết bị. Sự cố sẽ được gửi khi có kết nối."
		);
	};

	const handleIncidentUpdated = async () => {
		await incidents.syncNow();
		if (resolvingIncident) {
			const updated = incidents.items.find((i) => i.id === resolvingIncident.id);
			if (updated) {
				setResolvingIncident(updated);
				setDetailedIncident(updated);
			}
		}
	};

	// Status counts for filter pills
	const statusCounts = useMemo(() => {
		const counts: Record<IncidentStatusFilter, number> = {
			all: incidents.items.length,
			open: 0,
			investigating: 0,
			resolved: 0,
			closed: 0,
		};
		for (const item of incidents.items) {
			if (item.status && counts[item.status] !== undefined) {
				counts[item.status]++;
			}
		}
		return counts;
	}, [incidents.items]);

	// Filtered list
	const filteredItems = useMemo(() => {
		return incidents.items.filter((item) => {
			if (statusFilter !== "all" && item.status !== statusFilter) {
				return false;
			}
			if (categoryFilter !== "all" && item.category !== categoryFilter) {
				return false;
			}
			if (search.trim()) {
				const q = search.toLowerCase();
				const matchDesc = item.description.toLowerCase().includes(q);
				const matchReporter = item.reporterName?.toLowerCase().includes(q) ?? false;
				const matchAssignee = item.assignedToName?.toLowerCase().includes(q) ?? false;
				if (!matchDesc && !matchReporter && !matchAssignee) {
					return false;
				}
			}
			return true;
		});
	}, [incidents.items, statusFilter, categoryFilter, search]);

	const handleResetFilters = () => {
		setSearch("");
		setStatusFilter("all");
		setCategoryFilter("all");
		setCurrentPage(1);
	};

	return (
		<div className="space-y-4">
			{/* Header with Connection Indicator */}
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

			{/* Unsent items alert banner */}
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

			{/* Filter Bar */}
			<TripIncidentsFilterBar
				search={search}
				statusFilter={statusFilter}
				categoryFilter={categoryFilter}
				statusCounts={statusCounts}
				onSearchChange={(s) => {
					setSearch(s);
					setCurrentPage(1);
				}}
				onStatusFilterChange={(st) => {
					setStatusFilter(st);
					setCurrentPage(1);
				}}
				onCategoryFilterChange={(cat) => {
					setCategoryFilter(cat);
					setCurrentPage(1);
				}}
				onResetFilters={handleResetFilters}
			/>

			{/* Loading State or Data Table */}
			{incidents.isLoading ? (
				<p className="flex items-center gap-2 py-6 text-sm text-[#667a6d]">
					<Loader2 aria-hidden="true" className="size-4 animate-spin" />
					<span>Đang tải sự cố...</span>
				</p>
			) : incidents.items.length === 0 ? (
				<p className="py-6 text-sm text-[#667a6d]">Chưa có sự cố nào được báo cáo.</p>
			) : (
				<TripIncidentsTable
					items={filteredItems}
					currentPage={currentPage}
					itemsPerPage={5}
					onPageChange={setCurrentPage}
					onViewDetail={(item) => setDetailedIncident(item)}
					onRetry={(id) => void incidents.retry(id)}
					onDiscard={(id) => void incidents.discard(id)}
				/>
			)}

			{/* Detail Modal (Opens when eye icon is clicked) */}
			{detailedIncident && (
				<IncidentDetailModal
					isOpen={detailedIncident !== null}
					onClose={() => setDetailedIncident(null)}
					incident={detailedIncident}
					canManage={canManage}
					onOpenResolution={(item) => setResolvingIncident(item)}
				/>
			)}

			{/* Resolution Modal (Triggered from detail modal or directly) */}
			{resolvingIncident && (
				<IncidentResolutionModal
					isOpen={resolvingIncident !== null}
					onClose={() => setResolvingIncident(null)}
					incident={resolvingIncident}
					tripId={tripId}
					onIncidentUpdated={handleIncidentUpdated}
					api={api}
				/>
			)}
		</div>
	);
}
