import { useState } from "react";
import { Button, Card, PageSkeleton, Pagination } from "../../../shared/components";
import { AdminReviewFilters } from "../../../shared/components/AdminReviewFilters";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { HotspotDetailModal } from "../components/HotspotDetailModal";
import { HotspotTable } from "../components/HotspotTable";
import { HOTSPOT_PAGE_SIZE, HOTSPOT_STATUS_FILTERS } from "../constants";
import { useSafetyHotspots } from "../hooks/useSafetyHotspots";
import type { HotspotStatus, SafetyHotspot } from "../types";

export function AdminSafetyHotspotsPage({
	onLogout,
}: {
	onLogout?: (allDevices: boolean) => Promise<void>;
}) {
	const [status, setStatus] = useState<HotspotStatus>("CONFIRMED");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<SafetyHotspot | null>(null);
	const hotspots = useSafetyHotspots(status);
	const totalPages = Math.max(1, Math.ceil(hotspots.items.length / HOTSPOT_PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const rows = hotspots.items.slice(
		(currentPage - 1) * HOTSPOT_PAGE_SIZE,
		currentPage * HOTSPOT_PAGE_SIZE
	);
	const changeStatus = (next: HotspotStatus) => {
		setStatus(next);
		setPage(1);
	};

	return (
		<AdminLayout activeItem="safety-hotspots" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<h1 className="text-2xl font-bold tracking-tight text-[#10221b]">Điểm nóng an toàn</h1>

				<Card className="space-y-4 p-6">
					<AdminReviewFilters
						value={status}
						options={HOTSPOT_STATUS_FILTERS}
						onChange={changeStatus}
					/>

					{hotspots.error && (
						<div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
							<span role="alert">{hotspots.error}</span>
							<Button size="sm" variant="outline" onClick={() => void hotspots.reload()}>
								Thử lại
							</Button>
						</div>
					)}

					{hotspots.loading && <PageSkeleton />}
					{!hotspots.loading && !hotspots.error && (
						<>
							<HotspotTable rows={rows} onOpen={setSelected} />
							<Pagination
								currentPage={currentPage}
								totalPages={totalPages}
								totalItems={hotspots.items.length}
								itemsPerPage={HOTSPOT_PAGE_SIZE}
								onPageChange={setPage}
							/>
						</>
					)}
				</Card>
			</div>

			{selected && (
				<HotspotDetailModal
					hotspot={selected}
					onClose={() => setSelected(null)}
					onChanged={() => void hotspots.reload()}
				/>
			)}
		</AdminLayout>
	);
}
