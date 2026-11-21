import { useState } from "react";
import { Button, Card, PageSkeleton, Pagination } from "../../../shared/components";
import { AdminReviewFilters } from "../../../shared/components/AdminReviewFilters";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { ProposalDetailModal } from "../components/ProposalDetailModal";
import { ProposalTable } from "../components/ProposalTable";
import { PROPOSAL_PAGE_SIZE, PROPOSAL_STATUS_FILTERS } from "../constants";
import { useDangerZoneProposals } from "../hooks/useDangerZoneProposals";
import type { DangerZoneProposal, ProposalStatusFilter } from "../types";

export function AdminDangerZoneProposalsPage({
	onLogout,
}: {
	onLogout?: (allDevices: boolean) => Promise<void>;
}) {
	const [status, setStatus] = useState<ProposalStatusFilter>("PENDING");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<DangerZoneProposal | null>(null);
	const proposals = useDangerZoneProposals(status);
	const totalPages = Math.max(1, Math.ceil(proposals.items.length / PROPOSAL_PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const rows = proposals.items.slice(
		(currentPage - 1) * PROPOSAL_PAGE_SIZE,
		currentPage * PROPOSAL_PAGE_SIZE
	);
	const changeStatus = (next: ProposalStatusFilter) => {
		setStatus(next);
		setPage(1);
	};

	return (
		<AdminLayout activeItem="danger-zone-proposals" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<header className="space-y-4">
					<h1 className="text-2xl font-bold tracking-tight text-[#10221b]">
						Đề xuất điểm nguy hiểm
					</h1>
					<AdminReviewFilters
						value={status}
						options={PROPOSAL_STATUS_FILTERS}
						onChange={changeStatus}
					/>
				</header>

				<Card className="space-y-4 p-6">
					{proposals.error && (
						<div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
							<span role="alert">{proposals.error}</span>
							<Button size="sm" variant="outline" onClick={() => void proposals.reload()}>
								Thử lại
							</Button>
						</div>
					)}

					{proposals.loading && <PageSkeleton />}
					{!proposals.loading && !proposals.error && (
						<>
							<ProposalTable rows={rows} onOpen={setSelected} />
							<Pagination
								currentPage={currentPage}
								totalPages={totalPages}
								totalItems={proposals.items.length}
								itemsPerPage={PROPOSAL_PAGE_SIZE}
								onPageChange={setPage}
							/>
						</>
					)}
				</Card>
			</div>

			{selected && (
				<ProposalDetailModal
					proposal={selected}
					onClose={() => setSelected(null)}
					onDecided={(next) => {
						setSelected(next);
						void proposals.reload();
					}}
				/>
			)}
		</AdminLayout>
	);
}
