import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../../../core/api";
import { Button, Modal } from "../../../shared/components";
import { LEVEL_QUERY_STALE_TIME, levelReviewError } from "../constants";
import { useLevelRequests } from "../hooks/useLevelRequests";
import type { RequestFilters } from "../request-types";
import { porterLevelsService } from "../services/porter-levels.service";
import { LevelRequestAdminActions } from "./LevelRequestAdminActions";
import { LevelRequestDetailView } from "./LevelRequestDetailView";
import { LevelRequestFilters } from "./LevelRequestFilters";
import { LevelRequestList } from "./LevelRequestList";
export function AdminLevelRequestsPanel() {
	const [filters, setFilters] = useState<RequestFilters>({ page: 1, status: "pending" });
	const [id, setId] = useState<string | null>(() =>
		new URLSearchParams(window.location.search).get("request")
	);
	const state = useLevelRequests(true, filters, id);
	const detail = state.detail.data;
	const porterId = detail?.request.porterId ?? null;
	const globalOverviewQuery = useQuery({
		queryKey: queryKeys.porterLevels.globalPorterOverview(porterId),
		enabled: Boolean(porterId),
		staleTime: LEVEL_QUERY_STALE_TIME,
		refetchOnWindowFocus: false,
		queryFn: () => porterLevelsService.globalPorterOverview(porterId as string),
	});
	const pending = state.review.isPending || state.download.isPending;
	return (
		<section className="space-y-4 rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-lg font-bold">Yêu cầu nâng cấp</h2>
				<Button variant="outline" onClick={() => void state.list.refetch()}>
					Làm mới
				</Button>
			</div>
			<LevelRequestFilters admin filters={filters} onChange={setFilters} />
			{state.list.isPending && <output>Đang tải yêu cầu…</output>}
			{state.list.isError && <p role="alert">{levelReviewError(state.list.error)}</p>}
			{state.list.data && (
				<LevelRequestList
					admin
					data={state.list.data}
					page={filters.page}
					onPage={(page) => setFilters({ ...filters, page })}
					onSelect={(requestId) => {
						setId(requestId);
						state.review.reset();
						state.download.reset();
					}}
				/>
			)}
			<Modal
				isOpen={Boolean(id)}
				onClose={() => setId(null)}
				isCloseDisabled={pending}
				title="Yêu cầu nâng cấp"
				size="xl"
			>
				<div className="space-y-5">
					{state.detail.isPending && <output>Đang tải hồ sơ…</output>}
					{state.detail.isError && (
						<p role="alert">
							{levelReviewError(state.detail.error)}{" "}
							<Button onClick={() => void state.detail.refetch()}>Thử lại</Button>
						</p>
					)}
					{detail && (
						<>
							<LevelRequestDetailView
								detail={detail}
								globalOverview={globalOverviewQuery.data}
								pending={pending}
								onDownload={(file) => state.download.mutate(file)}
							/>
							<LevelRequestAdminActions
								key={`${detail.request.id}-${detail.request.status}`}
								detail={detail}
								pending={pending || state.detail.isFetching}
								error={state.review.error}
								onReview={state.review.mutateAsync}
							/>
						</>
					)}
					{state.download.isError && <p role="alert">{levelReviewError(state.download.error)}</p>}
					{state.review.isSuccess && (
						<output className="block text-green-800">Đã lưu phản hồi cho người hỗ trợ.</output>
					)}
				</div>
			</Modal>
		</section>
	);
}
