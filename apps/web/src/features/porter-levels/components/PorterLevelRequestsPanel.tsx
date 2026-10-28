import { useState } from "react";
import { Button, Modal } from "../../../shared/components";
import { LEVEL_PANEL_CLASS, levelReviewError } from "../constants";
import { useLevelRequests } from "../hooks/useLevelRequests";
import { useMyPorterLevels } from "../hooks/usePorterLevels";
import type { RequestFilters } from "../request-types";
import { CreateLevelRequestForm } from "./CreateLevelRequestForm";
import { LevelRequestDetailView } from "./LevelRequestDetailView";
import { LevelRequestFilters } from "./LevelRequestFilters";
import { LevelRequestList } from "./LevelRequestList";
import { LevelRequestPorterActions } from "./LevelRequestPorterActions";
import { PorterLevelNotifications } from "./PorterLevelNotifications";
export function PorterLevelRequestsPanel() {
	const [filters, setFilters] = useState<RequestFilters>({ page: 1 });
	const [id, setId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const state = useLevelRequests(false, filters, id);
	const { policies } = useMyPorterLevels();
	const detail = state.detail.data;
	const canCreate =
		state.qualifications.data?.some(
			(item) => item.proficiency !== "expert" && !item.openRequestId
		) ?? false;
	const pending =
		state.cancel.isPending ||
		state.resubmit.isPending ||
		state.add.isPending ||
		state.remove.isPending ||
		state.download.isPending;
	const error = state.cancel.error ?? state.resubmit.error ?? state.add.error ?? state.remove.error;
	const select = (requestId: string) => {
		setId(requestId);
		state.cancel.reset();
		state.resubmit.reset();
		state.add.reset();
		state.remove.reset();
		state.download.reset();
	};
	return (
		<section className={`${LEVEL_PANEL_CLASS} space-y-4`}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-lg font-bold">Yêu cầu nâng cấp theo tuyến</h2>
				<Button
					disabled={!canCreate}
					onClick={() => {
						setCreating(true);
						state.create.reset();
					}}
				>
					Yêu cầu nâng cấp
				</Button>
			</div>
			<PorterLevelNotifications onSelect={select} />
			{state.qualifications.isSuccess && !canCreate && (
				<p className="text-sm text-[#627769]">
					Chỉ có thể yêu cầu nâng cấp cho tuyến đã khai báo, chưa ở cấp Chuyên gia và không có yêu
					cầu đang xử lý. Chuyên gia là cấp cao nhất; việc hạ cấp hoặc công nhận cấp do Admin thực
					hiện.
				</p>
			)}
			{state.qualifications.isError && (
				<p role="alert">
					{levelReviewError(state.qualifications.error)}{" "}
					<Button variant="outline" onClick={() => void state.qualifications.refetch()}>
						Tải lại tuyến đã khai báo
					</Button>
				</p>
			)}
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-0 flex-1">
					<LevelRequestFilters admin={false} filters={filters} onChange={setFilters} />
				</div>
				<Button variant="outline" onClick={() => void state.list.refetch()}>
					Làm mới yêu cầu
				</Button>
			</div>
			{state.list.isPending && <output>Đang tải yêu cầu…</output>}
			{state.list.isError && <p role="alert">{levelReviewError(state.list.error)}</p>}
			{state.list.data && (
				<LevelRequestList
					admin={false}
					data={state.list.data}
					page={filters.page}
					onPage={(page) => setFilters({ ...filters, page })}
					onSelect={select}
				/>
			)}
			<Modal
				isOpen={creating}
				onClose={() => setCreating(false)}
				isCloseDisabled={state.create.isPending}
				title="Yêu cầu nâng cấp theo tuyến"
				size="xl"
			>
				{state.qualifications.isPending && <p>Đang tải tuyến đã khai báo…</p>}
				{state.qualifications.isError && (
					<p role="alert">
						{levelReviewError(state.qualifications.error)}{" "}
						<Button onClick={() => void state.qualifications.refetch()}>Thử lại</Button>
					</p>
				)}
				{state.qualifications.data?.length === 0 && (
					<p>Bạn cần thêm năng lực tuyến trong phần Năng lực theo tuyến trekking trước.</p>
				)}
				{state.qualifications.data && (
					<CreateLevelRequestForm
						qualifications={state.qualifications.data}
						policies={policies.data ?? []}
						pending={state.create.isPending}
						error={state.create.error}
						onCreate={async (input) => {
							const result = await state.create.mutateAsync(input);
							setCreating(false);
							return result;
						}}
					/>
				)}
			</Modal>
			<Modal
				isOpen={Boolean(id)}
				onClose={() => setId(null)}
				isCloseDisabled={pending}
				title="Chi tiết yêu cầu nâng cấp"
				size="xl"
			>
				<div className="space-y-5">
					<Button
						variant="outline"
						disabled={pending || state.detail.isFetching}
						onClick={() => void state.detail.refetch()}
					>
						Tải lại yêu cầu
					</Button>
					{state.detail.isPending && <output>Đang tải yêu cầu…</output>}
					{state.detail.isError && <p role="alert">{levelReviewError(state.detail.error)}</p>}
					{detail && (
						<>
							<LevelRequestDetailView
								detail={detail}
								pending={pending}
								onDownload={(file) => state.download.mutate(file)}
								onRemove={
									detail.request.status === "needs_info"
										? (fileId) => state.remove.mutate({ fileId, version: detail.request.version })
										: undefined
								}
							/>
							<LevelRequestPorterActions
								key={`${detail.request.id}-${detail.request.status}`}
								detail={detail}
								pending={pending || state.detail.isFetching}
								error={error}
								onCancel={() => state.cancel.mutate(detail.request.version)}
								onResubmit={(reason) =>
									state.resubmit.mutateAsync({ reason, version: detail.request.version })
								}
								onAdd={(files) => state.add.mutateAsync({ files, version: detail.request.version })}
							/>
						</>
					)}
					{state.download.isError && <p role="alert">{levelReviewError(state.download.error)}</p>}
					{(state.cancel.isSuccess ||
						state.resubmit.isSuccess ||
						state.add.isSuccess ||
						state.remove.isSuccess) && (
						<output className="block text-green-800">Đã cập nhật yêu cầu.</output>
					)}
				</div>
			</Modal>
		</section>
	);
}
