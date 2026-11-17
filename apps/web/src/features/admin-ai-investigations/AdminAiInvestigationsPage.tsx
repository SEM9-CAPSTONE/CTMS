import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { queryKeys } from "../../core/api";
import { Button, DataTable, Modal, Pagination, StatusBadge, toast } from "../../shared/components";
import { AdminLayout } from "../admin-layout/components/AdminLayout";
import { getStoredAuthUser } from "../auth/utils/tokenStorage";
import { InvestigationActions } from "./InvestigationActions";
import {
	InvestigationEvidence,
	InvestigationHistory,
	InvestigationReport,
} from "./InvestigationReport";
import {
	formatInvestigationDate,
	investigationTitle,
	issueLabels,
	processingLabels,
	reviewLabels,
	technicalLabels,
} from "./ai-investigations.display";
import { aiInvestigationsService, investigationError } from "./ai-investigations.service";
import type {
	InvestigationCommand,
	InvestigationFilters,
	InvestigationSummary,
	ReviewStatus,
} from "./ai-investigations.types";

const keys = queryKeys.aiInvestigations;
const controlClass =
	"block rounded-lg border border-[#dfe8df] bg-white px-3 py-2 text-sm text-[#10221b]";
const successMessages = {
	START_REVIEW: "Đã tiếp nhận hồ sơ để xem xét.",
	HANDOFF: "Đã lưu thông tin bàn giao kỹ thuật.",
	RESOLVE: "Đã lưu kết luận và đóng hồ sơ.",
};

function isAccessError(status: number | undefined) {
	return status === 401 || status === 403 || status === 404;
}

function LoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
	const { message, status } = investigationError(error);
	return (
		<div className="space-y-2 text-sm text-[#54655a]">
			<p role="alert">{message}</p>
			{onRetry && !isAccessError(status) && (
				<Button variant="outline" size="sm" onClick={onRetry}>
					Thử tải lại
				</Button>
			)}
		</div>
	);
}

function CaseBadges({
	item,
	includeReview = true,
}: { item: InvestigationSummary; includeReview?: boolean }) {
	const review = item.reviewStatus && reviewLabels[item.reviewStatus];
	const [processing, processingTone] = processingLabels[item.processingStatus];
	const [technical, technicalTone] = technicalLabels[item.technicalStatus];
	return (
		<div className="flex flex-wrap gap-2">
			{includeReview && review && <StatusBadge tone={review[1]}>{review[0]}</StatusBadge>}
			<StatusBadge tone={processingTone}>{processing}</StatusBadge>
			<StatusBadge tone={technicalTone}>{technical}</StatusBadge>
		</div>
	);
}

function CaseDialog({
	actor,
	id,
	onClose,
	onGroupOpen,
}: {
	actor: string;
	id: string;
	onClose: () => void;
	onGroupOpen: (id: string) => void;
}) {
	const client = useQueryClient();
	const queryKey = keys.detail(actor, id);
	const detailQuery = useQuery({
		queryKey,
		queryFn: ({ signal }) => aiInvestigationsService.detail(id, signal),
		gcTime: 0,
		refetchOnWindowFocus: false,
		retry: false,
	});
	const refresh = async () => {
		await Promise.all([
			client.invalidateQueries({ queryKey }),
			client.invalidateQueries({ queryKey: keys.lists(actor) }),
		]);
	};
	const mutation = useMutation({
		mutationFn: (command: InvestigationCommand) => aiInvestigationsService.update(id, command),
		onSuccess: async (_, command) => {
			toast.success(successMessages[command.action]);
			await refresh();
		},
		onError: async (error) => {
			const { status, message } = investigationError(error);
			toast.error(message);
			if (status === 409) await refresh();
		},
	});
	const inFlight = useRef(false);
	const save = async (command: InvestigationCommand) => {
		if (inFlight.current || detailQuery.isFetching) return false;
		inFlight.current = true;
		try {
			await mutation.mutateAsync(command);
			return true;
		} catch {
			return false;
		} finally {
			inFlight.current = false;
		}
	};
	const writeAccessDenied =
		mutation.isError && isAccessError(investigationError(mutation.error).status);
	const detail = !writeAccessDenied && detailQuery.isSuccess ? detailQuery.data : null;
	const reportedAt = detail && (detail.reportedAt ?? detail.createdAt);
	return (
		<Modal
			isOpen
			onClose={onClose}
			isCloseDisabled={mutation.isPending}
			title={detail ? investigationTitle(detail) : "Chi tiết hồ sơ điều tra"}
			description={reportedAt ? formatInvestigationDate(reportedAt) : undefined}
			size="2xl"
		>
			{detailQuery.isPending && <output className="text-sm text-[#54655a]">Đang tải hồ sơ…</output>}
			{writeAccessDenied && <LoadError error={mutation.error} />}
			{detailQuery.isError && !writeAccessDenied && (
				<LoadError error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
			)}
			{detail && (
				<div className="space-y-5">
					<div className="space-y-3 border-b border-[#e0ebe0] pb-4">
						<CaseBadges item={detail} />
						{detail.reviewerName && (
							<p className="text-sm text-[#54655a]">
								Người xem xét · {detail.reviewerName}
								{detail.reviewedAt && ` · ${formatInvestigationDate(detail.reviewedAt)}`}
							</p>
						)}
						{detail.resolutionNote && (
							<p className="whitespace-pre-wrap break-words text-sm text-[#10221b]">
								Kết luận · {detail.resolutionNote}
							</p>
						)}
						<InvestigationActions
							detail={detail}
							busy={mutation.isPending || detailQuery.isFetching}
							onSave={save}
						/>
					</div>
					<InvestigationReport
						detail={detail}
						onGroupOpen={(groupId) => {
							if (!inFlight.current) onGroupOpen(groupId);
						}}
					/>
					<InvestigationEvidence detail={detail} />
					<InvestigationHistory detail={detail} />
				</div>
			)}
		</Modal>
	);
}

const initialFilters: InvestigationFilters = { scope: "UNSAFE", page: 1 };

export function AdminAiInvestigationsPage({
	onLogout,
}: { onLogout?: (allDevices: boolean) => Promise<void> }) {
	const actor = getStoredAuthUser()?.id ?? "";
	const [filters, setFilters] = useState<InvestigationFilters>(initialFilters);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const queue = useQuery({
		queryKey: keys.list(actor, filters),
		queryFn: ({ signal }) => aiInvestigationsService.list(filters, signal),
		gcTime: 0,
		refetchOnWindowFocus: false,
		retry: false,
	});
	const pagination = queue.data?.pagination;
	return (
		<AdminLayout activeItem="ai-investigations" onLogout={onLogout} allowMobile>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h1 className="text-2xl font-extrabold text-[#10221b]">Điều tra phản hồi AI</h1>
					<Button
						variant="outline"
						size="sm"
						disabled={queue.isFetching}
						onClick={() => void queue.refetch()}
					>
						Tải lại danh sách
					</Button>
				</div>
				<section className="flex flex-wrap items-end gap-3" aria-label="Bộ lọc hồ sơ">
					<label className="space-y-1 text-sm font-semibold text-[#54655a]">
						<span>Loại hồ sơ</span>
						<select
							className={controlClass}
							value={filters.scope}
							onChange={(event) =>
								setFilters({ scope: event.target.value === "UNSAFE" ? "UNSAFE" : "ALL", page: 1 })
							}
						>
							<option value="UNSAFE">Báo cáo nguy hiểm</option>
							<option value="ALL">Tất cả hồ sơ</option>
						</select>
					</label>
					{filters.scope === "UNSAFE" && (
						<label className="space-y-1 text-sm font-semibold text-[#54655a]">
							<span>Trạng thái xem xét</span>
							<select
								className={controlClass}
								value={filters.reviewStatus ?? ""}
								onChange={(event) =>
									setFilters({
										...filters,
										reviewStatus: (event.target.value as ReviewStatus) || undefined,
										page: 1,
									})
								}
							>
								<option value="">Tất cả trạng thái</option>
								{Object.entries(reviewLabels).map(([value, [label]]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						</label>
					)}
					{filters.groupId && (
						<div className="flex items-center gap-2">
							{queue.data?.group && (
								<StatusBadge tone="info">
									{issueLabels[queue.data.group.classification]}
								</StatusBadge>
							)}
							<Button size="sm" variant="ghost" onClick={() => setFilters(initialFilters)}>
								Bỏ lọc nhóm
							</Button>
						</div>
					)}
				</section>
				{queue.isPending && (
					<output className="text-sm text-[#54655a]">Đang tải danh sách hồ sơ…</output>
				)}
				{queue.isError && <LoadError error={queue.error} onRetry={() => void queue.refetch()} />}
				{queue.isSuccess && pagination && (
					<>
						<DataTable
							ariaLabel="Danh sách hồ sơ điều tra"
							rows={queue.data.items}
							getRowKey={(row) => row.id}
							emptyMessage="Không có hồ sơ phù hợp với bộ lọc."
							columns={[
								{
									key: "case",
									header: "Hồ sơ",
									render: (row) => (
										<div className="whitespace-nowrap">
											<p className="font-semibold text-[#10221b]">{investigationTitle(row)}</p>
											<p className="text-xs text-[#54655a]">
												{row.mode === "LOCAL" ? "Trả lời trên thiết bị" : "Trả lời trực tuyến"}
											</p>
										</div>
									),
								},
								{
									key: "date",
									header: "Thời gian",
									render: (row) => (
										<time className="whitespace-nowrap" dateTime={row.reportedAt ?? row.createdAt}>
											{formatInvestigationDate(row.reportedAt ?? row.createdAt)}
										</time>
									),
								},
								{
									key: "review",
									header: "Xem xét",
									render: (row) =>
										row.reviewStatus ? (
											<StatusBadge tone={reviewLabels[row.reviewStatus][1]}>
												{reviewLabels[row.reviewStatus][0]}
											</StatusBadge>
										) : (
											"—"
										),
								},
								{
									key: "status",
									header: "Phân tích và xử lý kỹ thuật",
									render: (row) => <CaseBadges item={row} includeReview={false} />,
								},
								{
									key: "open",
									header: "Thao tác",
									render: (row) => (
										<Button
											size="sm"
											variant="outline"
											aria-label={`Xem ${investigationTitle(row).toLowerCase()} ngày ${formatInvestigationDate(row.reportedAt ?? row.createdAt)}`}
											onClick={() => setSelectedId(row.id)}
										>
											Xem hồ sơ
										</Button>
									),
								},
							]}
						/>
						<Pagination
							currentPage={pagination.page}
							totalPages={pagination.totalPages}
							totalItems={pagination.total}
							itemsPerPage={pagination.limit}
							onPageChange={(page) => setFilters({ ...filters, page })}
						/>
					</>
				)}
			</div>
			{selectedId && (
				<CaseDialog
					key={selectedId}
					actor={actor}
					id={selectedId}
					onClose={() => setSelectedId(null)}
					onGroupOpen={(groupId) => {
						setSelectedId(null);
						setFilters({ scope: "ALL", groupId, page: 1 });
					}}
				/>
			)}
		</AdminLayout>
	);
}
