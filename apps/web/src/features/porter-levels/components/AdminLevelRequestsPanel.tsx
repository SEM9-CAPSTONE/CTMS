import { useState } from "react";
import { Button, Modal } from "../../../shared/components";
import { LEVEL_PANEL_CLASS, levelReviewError } from "../constants";
import { useLevelRequests } from "../hooks/useLevelRequests";
import type { RequestFilters } from "../request-types";
import { LevelRequestAdminActions } from "./LevelRequestAdminActions";
import { LevelRequestDetailView } from "./LevelRequestDetailView";
import { LevelRequestFilters } from "./LevelRequestFilters";
import { LevelRequestList } from "./LevelRequestList";
export function AdminLevelRequestsPanel() {
	const [filters, setFilters] = useState<RequestFilters>({ page: 1 });
	const [id, setId] = useState<string | null>(() =>
		new URLSearchParams(window.location.search).get("request")
	);
	const state = useLevelRequests(true, filters, id);
	const detail = state.detail.data;
	const pending = state.review.isPending || state.download.isPending;
	return (
		<section className={`${LEVEL_PANEL_CLASS} space-y-4`}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-lg font-bold">Yêu cầu nâng cấp của Porter</h2>
				<Button variant="outline" onClick={() => void state.list.refetch()}>
					Làm mới yêu cầu
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
				title="Xử lý yêu cầu nâng cấp"
				size="xl"
			>
				<div className="space-y-5">
					<Button
						variant="outline"
						disabled={pending || state.detail.isFetching}
						onClick={() => void state.detail.refetch()}
					>
						Tải lại yêu cầu và hồ sơ
					</Button>
					{state.detail.isPending && <output>Đang tải hồ sơ…</output>}
					{state.detail.isError && <p role="alert">{levelReviewError(state.detail.error)}</p>}
					{detail && (
						<>
							<LevelRequestDetailView
								detail={detail}
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
						<output className="block text-green-800">
							Đã lưu quyết định và gửi thông báo cho Porter.
						</output>
					)}
				</div>
			</Modal>
		</section>
	);
}
