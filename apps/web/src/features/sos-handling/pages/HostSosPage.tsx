import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { HostSosDetailModal } from "../components/HostSosDetailModal";
import { HostSosFilterBar, type SosStatusFilter } from "../components/HostSosFilterBar";
import { HostSosTable } from "../components/HostSosTable";
import { SosResolutionModal } from "../components/SosResolutionModal";
import { useHostSos } from "../hooks/useHostSos";
import type { SosAlertItem } from "../types";

export function HostSosPage() {
	const client = useQueryClient();
	const [statusFilter, setStatusFilter] = useState<SosStatusFilter>("all");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);

	// Modals state
	const [detailItem, setDetailItem] = useState<SosAlertItem | null>(null);
	const [resolutionItem, setResolutionItem] = useState<SosAlertItem | null>(null);

	// Fetch filtered list
	const { data, isLoading, refetch } = useHostSos({
		status: statusFilter,
		search: search.trim() ? search : undefined,
		page,
		limit: 10,
	});

	// Fetch all to get tab count badges
	const allQuery = useHostSos({ limit: 50 });
	const allItems = allQuery.data?.items ?? [];

	const counts = {
		all: allItems.length,
		active: allItems.filter((i) => i.status === "active").length,
		acknowledged: allItems.filter((i) => i.status === "acknowledged").length,
		closed: allItems.filter((i) => i.status === "closed").length,
		cancelled: allItems.filter((i) => i.status === "cancelled").length,
	};

	const handleStatusChange = (newStatus: SosStatusFilter) => {
		setStatusFilter(newStatus);
		setPage(1);
	};

	const handleSearchChange = (val: string) => {
		setSearch(val);
		setPage(1);
	};

	const handleUpdated = () => {
		void refetch();
		void allQuery.refetch();
		void client.invalidateQueries({ queryKey: ["host-overview"] });
	};

	return (
		<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
			{/* Minimalist Header */}
			<div className="flex flex-col gap-1 border-b border-[#e7eee7] pb-5">
				<h1 className="text-2xl font-bold tracking-tight text-[#164027]">
					Yêu cầu cứu trợ khẩn cấp
				</h1>
				<p className="text-xs text-[#627769]">
					Theo dõi, tiếp nhận và điều phối cứu hộ tức thời cho các thành viên trong chuyến đi.
				</p>
			</div>

			{/* Filter Bar */}
			<HostSosFilterBar
				statusFilter={statusFilter}
				onStatusChange={handleStatusChange}
				search={search}
				onSearchChange={handleSearchChange}
				counts={counts}
			/>

			{/* Data Table */}
			<HostSosTable
				items={data?.items ?? []}
				total={data?.total ?? 0}
				page={page}
				limit={10}
				onPageChange={setPage}
				onViewDetail={setDetailItem}
				isLoading={isLoading}
			/>

			{/* Detail Modal */}
			<HostSosDetailModal
				isOpen={detailItem !== null}
				onClose={() => setDetailItem(null)}
				sos={detailItem}
				onAcknowledge={setResolutionItem}
				onCloseSos={setResolutionItem}
			/>

			{/* Resolution Modal (Acknowledge / Close) */}
			<SosResolutionModal
				isOpen={resolutionItem !== null}
				onClose={() => setResolutionItem(null)}
				sos={
					resolutionItem
						? {
								id: resolutionItem.id,
								tripId: resolutionItem.tripId,
								status: resolutionItem.status,
								emergencyType: resolutionItem.emergencyType,
								eventTime: resolutionItem.eventTime,
							}
						: null
				}
				onUpdated={handleUpdated}
			/>
		</div>
	);
}
