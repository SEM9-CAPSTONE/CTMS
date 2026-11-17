import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CircleCheck,
	FileText,
	Inbox,
	Layers,
	Monitor,
	RefreshCw,
	Search,
	ShieldAlert,
	Smartphone,
	Sparkles,
	ThumbsDown,
	X,
} from "lucide-react";
import {
	type KeyboardEvent,
	type MutableRefObject,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { queryKeys } from "../../core/api";
import { Button, DataTable, Pagination, StatusBadge, toast } from "../../shared/components";
import type { StatusBadgeTone } from "../../shared/components";
import { AdminLayout } from "../admin-layout/components/AdminLayout";
import { getStoredAuthUser } from "../auth/utils/tokenStorage";
import { InvestigationActions } from "./InvestigationActions";
import {
	InvestigationEvidence,
	InvestigationFeedback,
	InvestigationHistory,
	InvestigationReport,
} from "./InvestigationReport";
import {
	formatInvestigationDate,
	investigationCategory,
	issueLabels,
	processingLabels,
	reviewLabels,
	technicalLabels,
} from "./ai-investigations.display";
import { aiInvestigationsService, investigationError } from "./ai-investigations.service";
import type {
	InvestigationCommand,
	InvestigationFilters,
	InvestigationList,
	InvestigationScope,
	InvestigationSummary,
	ReviewStatus,
} from "./ai-investigations.types";

const keys = queryKeys.aiInvestigations;
const controlClass =
	"block w-full rounded-lg border border-[#dfe8df] bg-white px-3 py-2 text-sm text-[#10221b]";
const focusRing =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d5a27]";
const categories = {
	UNSAFE: { label: "Báo cáo nguy hiểm", Icon: ShieldAlert, tone: "bg-red-50 text-red-700" },
	NOT_USEFUL: {
		label: "Phản hồi chưa hữu ích",
		Icon: ThumbsDown,
		tone: "bg-amber-50 text-amber-800",
	},
} as const;
const tabs = [
	{ value: "ALL", label: "Tất cả hồ sơ", Icon: Layers, tone: "text-[#2d5a27]" },
	{ value: "UNSAFE", ...categories.UNSAFE },
	{ value: "NOT_USEFUL", ...categories.NOT_USEFUL, label: "Chưa hữu ích" },
] as const;
const metrics = [
	{ key: "totalCases", label: "Tổng hồ sơ", Icon: Layers, tone: "bg-[#e5f3e2] text-[#205b29]" },
	{ key: "unsafeCases", ...categories.UNSAFE },
	{ key: "notUsefulCases", ...categories.NOT_USEFUL },
	{
		key: "resolvedCases",
		label: "Đã xử lý",
		Icon: CircleCheck,
		tone: "bg-emerald-50 text-emerald-700",
	},
] as const;
const numberFormat = new Intl.NumberFormat("vi-VN");
const successMessages = {
	START_REVIEW: "Đã bắt đầu xem xét hồ sơ.",
	HANDOFF: "Đã lưu thông tin bàn giao kỹ thuật.",
	RESOLVE: "Đã lưu kết luận và đóng hồ sơ.",
};

function isAccessError(status: number | undefined) {
	return status === 401 || status === 403 || status === 404;
}

function InvestigationMetrics({ summary }: { summary: InvestigationList["summary"] }) {
	return (
		<dl
			aria-label="Tổng quan hồ sơ phản hồi"
			className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4"
		>
			{metrics.map(({ key, label, Icon, tone }) => (
				<div
					key={key}
					className={`flex min-w-0 items-center gap-2 rounded-xl border p-2.5 shadow-xs sm:p-3 ${key === "totalCases" ? "border-[#b8d4b8] bg-[#f6faf5]" : "border-[#e1e6e2] bg-white"}`}
				>
					<Icon aria-hidden="true" className={`size-9 shrink-0 rounded-lg p-2 ${tone}`} />
					<div className="min-w-0">
						<dt className="text-xs font-semibold leading-tight text-[#394e40]">{label}</dt>
						<dd className="mt-0.5 text-xl font-extrabold leading-tight text-[#10221b]">
							{summary ? numberFormat.format(summary[key]) : "—"}
						</dd>
					</div>
				</div>
			))}
		</dl>
	);
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

function CaseBadge({ status }: { status: readonly [string, StatusBadgeTone] }) {
	return (
		<StatusBadge tone={status[1]}>
			<span className="whitespace-normal leading-tight">{status[0]}</span>
		</StatusBadge>
	);
}

function CaseCategory({ item }: { item: InvestigationSummary }) {
	const { Icon, label, tone } = categories[investigationCategory(item)];
	const ModeIcon = item.mode === "LOCAL" ? Smartphone : Monitor;
	return (
		<span className="flex items-center gap-2 text-left">
			<span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}>
				<Icon aria-hidden="true" className="size-4" />
			</span>
			<span className="min-w-0">
				<span className="block text-xs font-bold leading-tight">{label}</span>
				<span className="mt-1 flex items-center gap-1 text-xs text-[#54655a]">
					<ModeIcon aria-hidden="true" className="size-3" />
					{item.mode === "LOCAL" ? "Trên thiết bị" : "Trực tuyến"}
				</span>
			</span>
		</span>
	);
}

function CasePanel({
	actor,
	id,
	headingId,
	saving,
	onClose,
	onGroupOpen,
}: {
	actor: string;
	id: string;
	headingId: string;
	saving: MutableRefObject<boolean>;
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
	const save = async (command: InvestigationCommand) => {
		if (saving.current || detailQuery.isFetching) return false;
		saving.current = true;
		try {
			await mutation.mutateAsync(command);
			return true;
		} catch {
			return false;
		} finally {
			saving.current = false;
		}
	};
	const writeAccessDenied =
		mutation.isError && isAccessError(investigationError(mutation.error).status);
	const detail = !writeAccessDenied && detailQuery.isSuccess ? detailQuery.data : null;
	return (
		<>
			<header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[#e0ebe0] bg-white px-4 py-3">
				<h2 id={headingId} tabIndex={-1} className="flex items-center gap-2 text-lg font-extrabold">
					<FileText aria-hidden="true" className="size-5 text-[#2d5a27]" />
					Chi tiết hồ sơ
				</h2>
				<Button
					variant="ghost"
					size="sm"
					className={`size-9 p-0! ${focusRing}`}
					aria-label="Đóng chi tiết hồ sơ"
					title="Đóng chi tiết hồ sơ"
					disabled={mutation.isPending}
					onClick={onClose}
				>
					<X aria-hidden="true" className="size-5" />
				</Button>
			</header>
			<div className="space-y-4 p-4">
				{detailQuery.isPending && (
					<output className="text-sm text-[#54655a]">Đang tải hồ sơ…</output>
				)}
				{writeAccessDenied && <LoadError error={mutation.error} />}
				{detailQuery.isError && !writeAccessDenied && (
					<LoadError error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
				)}
				{detail && (
					<div className="space-y-4 divide-y divide-[#e0ebe0] [&>section]:pb-4 [&>section:last-child]:pb-0">
						<section className="space-y-2">
							<h3 className="text-base font-bold">Tổng quan hồ sơ</h3>
							<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f4f7f2] p-3">
								<CaseCategory item={detail} />
								<time
									className="text-xs text-[#54655a]"
									dateTime={detail.reportedAt ?? detail.createdAt}
								>
									{formatInvestigationDate(detail.reportedAt ?? detail.createdAt)}
								</time>
							</div>
							<dl className="flex flex-wrap gap-x-4 gap-y-2">
								{detail.reviewStatus && (
									<div className="space-y-1">
										<dt className="text-xs text-[#54655a]">Xem xét</dt>
										<dd>
											<CaseBadge status={reviewLabels[detail.reviewStatus]} />
										</dd>
									</div>
								)}
								<div className="space-y-1">
									<dt className="text-xs text-[#54655a]">Phân tích</dt>
									<dd>
										<CaseBadge status={processingLabels[detail.processingStatus]} />
									</dd>
								</div>
								<div className="space-y-1">
									<dt className="text-xs text-[#54655a]">Kỹ thuật</dt>
									<dd>
										<CaseBadge status={technicalLabels[detail.technicalStatus]} />
									</dd>
								</div>
							</dl>
							{(detail.reviewerName || detail.reviewedAt) && (
								<p className="text-sm text-[#54655a]">
									{detail.reviewerName && `Người xem xét · ${detail.reviewerName}`}
									{detail.reviewedAt && (
										<time dateTime={detail.reviewedAt}>
											{detail.reviewerName ? " · " : "Đã xem xét · "}
											{formatInvestigationDate(detail.reviewedAt)}
										</time>
									)}
								</p>
							)}
							{detail.resolutionNote &&
								!detail.history.some((entry) => entry.resolutionNote === detail.resolutionNote) && (
									<p className="whitespace-pre-wrap break-words text-sm text-[#10221b]">
										Kết luận · {detail.resolutionNote}
									</p>
								)}
						</section>
						<InvestigationFeedback detail={detail} />
						<InvestigationReport detail={detail} onGroupOpen={onGroupOpen} />
						<InvestigationEvidence detail={detail} />
						<InvestigationHistory detail={detail} />
						{!detail.closedAt && detail.reviewStatus !== "actioned" && (
							<section className="space-y-3">
								<h3 className="text-base font-bold">Hành động xử lý</h3>
								<InvestigationActions
									detail={detail}
									busy={mutation.isPending || detailQuery.isFetching}
									onSave={save}
								/>
							</section>
						)}
					</div>
				)}
			</div>
		</>
	);
}

const initialFilters: InvestigationFilters = { scope: "ALL", page: 1 };

export function AdminAiInvestigationsPage({
	onLogout,
}: { onLogout?: (allDevices: boolean) => Promise<void> }) {
	const actor = getStoredAuthUser()?.id ?? "";
	const listId = useId();
	const panelId = useId();
	const panel = useRef<HTMLElement>(null);
	const rowTrigger = useRef<HTMLButtonElement | null>(null);
	const saving = useRef(false);
	const [filters, setFilters] = useState<InvestigationFilters>(initialFilters);
	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const queue = useQuery({
		queryKey: keys.list(actor, filters),
		queryFn: ({ signal }) => aiInvestigationsService.list(filters, signal),
		placeholderData: keepPreviousData,
		gcTime: 0,
		refetchOnWindowFocus: false,
		retry: false,
	});
	const pagination = queue.data?.pagination;
	const loadingList = queue.isPending || queue.isPlaceholderData;
	useEffect(() => {
		if (selectedId) {
			if (panel.current) panel.current.scrollTop = 0;
			panel.current?.querySelector("h2")?.focus();
		} else if (rowTrigger.current) {
			const target = rowTrigger.current.isConnected
				? rowTrigger.current
				: document.getElementById(`${listId}-${filters.scope}`);
			target?.focus();
			rowTrigger.current = null;
		}
	}, [selectedId, filters.scope, listId]);
	const changeFilters = (next: InvestigationFilters, restoreFocus = false) => {
		if (saving.current) return;
		if (!restoreFocus) rowTrigger.current = null;
		setSelectedId(null);
		setFilters(next);
	};
	const selectCategory = (scope: InvestigationScope) => {
		if (scope === filters.scope) return;
		changeFilters({
			...filters,
			scope,
			reviewStatus: scope === "NOT_USEFUL" ? undefined : filters.reviewStatus,
			page: 1,
		});
	};
	const navigateTabs = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
		const targets: Record<string, number> = {
			ArrowRight: (index + 1) % tabs.length,
			ArrowLeft: (index + tabs.length - 1) % tabs.length,
			Home: 0,
			End: tabs.length - 1,
		};
		const next = tabs[targets[event.key]];
		if (!next || saving.current) return;
		event.preventDefault();
		selectCategory(next.value);
		document.getElementById(`${listId}-${next.value}`)?.focus();
	};
	return (
		<AdminLayout activeItem="ai-investigations" onLogout={onLogout} allowMobile>
			<div className="min-h-dvh bg-[#f6f7f8] px-4 py-5 sm:px-6">
				<div
					className={`mx-auto max-w-[104rem] ${selectedId ? "grid items-start gap-4 min-[1360px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : ""}`}
				>
					<div className="min-w-0 space-y-4">
						<header className="flex items-center justify-between gap-3">
							<h1 className="flex items-center gap-2 text-2xl font-extrabold leading-tight text-[#10221b]">
								<Sparkles aria-hidden="true" className="size-6 shrink-0 text-[#235b2d]" />
								Phân tích &amp; xử lý phản hồi AI
							</h1>
							<Button
								variant="outline"
								size="sm"
								className="size-9 shrink-0 p-0! focus-visible:ring-2 focus-visible:ring-[#2d5a27] focus-visible:ring-offset-2"
								aria-label="Tải lại danh sách"
								title="Tải lại danh sách"
								disabled={queue.isFetching}
								onClick={() => void queue.refetch()}
							>
								<RefreshCw
									aria-hidden="true"
									className={`size-4 ${queue.isFetching ? "motion-safe:animate-spin" : ""}`}
								/>
							</Button>
						</header>
						<div className={selectedId ? "hidden space-y-4 min-[1360px]:block" : "space-y-4"}>
							<InvestigationMetrics summary={queue.isError ? undefined : queue.data?.summary} />
							<div className="rounded-2xl border border-[#e1e6e2] bg-white p-3 shadow-sm sm:p-4">
								<div role="tablist" aria-label="Loại hồ sơ" className="mb-3 flex flex-wrap gap-2">
									{tabs.map(({ value, label, Icon, tone }, index) => (
										<button
											key={value}
											id={`${listId}-${value}`}
											type="button"
											role="tab"
											tabIndex={filters.scope === value ? 0 : -1}
											aria-selected={filters.scope === value}
											aria-controls={listId}
											className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${focusRing} ${filters.scope === value ? "border-[#b8d4b8] bg-[#e6f2e4] text-[#164027]" : "border-[#dfe8df] bg-white text-[#394e40] hover:bg-[#f4f7f2]"}`}
											onClick={() => selectCategory(value)}
											onKeyDown={(event) => navigateTabs(event, index)}
										>
											<Icon aria-hidden="true" className={`size-4 rounded-sm ${tone}`} />
											{label}
										</button>
									))}
								</div>
								<section
									id={listId}
									role="tabpanel"
									aria-labelledby={`${listId}-${filters.scope}`}
									className="space-y-3"
								>
									<div className="flex flex-wrap items-end gap-3 border-b border-[#e9ede9] pb-3">
										<form
											className="flex min-w-48 flex-1 items-center rounded-full border border-[#dfe8df] bg-white focus-within:border-[#2d5a27] focus-within:ring-1 focus-within:ring-[#2d5a27]"
											onSubmit={(event) => {
												event.preventDefault();
												changeFilters({ ...filters, q: search.trim() || undefined, page: 1 });
											}}
										>
											<button
												type="submit"
												aria-label="Tìm hồ sơ"
												className={`grid size-9 shrink-0 place-items-center rounded-full text-[#31563e] ${focusRing}`}
											>
												<Search aria-hidden="true" className="size-4" />
											</button>
											<input
												aria-label="Tìm theo câu hỏi hoặc câu trả lời"
												className="min-w-0 flex-1 py-2 pr-2 text-sm text-[#10221b] outline-none placeholder:text-[#54655a]"
												maxLength={180}
												value={search}
												onChange={(event) => setSearch(event.target.value)}
												placeholder="Tìm theo câu hỏi hoặc câu trả lời…"
											/>
											{(search || filters.q) && (
												<button
													type="button"
													aria-label="Xóa tìm kiếm"
													className={`grid size-9 shrink-0 place-items-center rounded-full text-[#31563e] ${focusRing}`}
													onClick={() => {
														if (saving.current) return;
														setSearch("");
														if (filters.q) changeFilters({ ...filters, q: undefined, page: 1 });
													}}
												>
													<X aria-hidden="true" className="size-4" />
												</button>
											)}
										</form>
										{filters.scope !== "NOT_USEFUL" && (
											<label className="w-full space-y-1 text-xs font-semibold text-[#54655a] sm:w-[35%] sm:min-w-40">
												<span>Trạng thái xem xét</span>
												<select
													className={controlClass}
													value={filters.reviewStatus ?? ""}
													onChange={(event) =>
														changeFilters({
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
												<Button
													size="sm"
													variant="ghost"
													onClick={() => changeFilters({ ...filters, groupId: undefined, page: 1 })}
												>
													Bỏ lọc nhóm
												</Button>
											</div>
										)}
									</div>
									{loadingList && (
										<output className="text-sm text-[#54655a]">Đang tải danh sách hồ sơ…</output>
									)}
									{queue.isError && (
										<LoadError error={queue.error} onRetry={() => void queue.refetch()} />
									)}
									{queue.isSuccess && !loadingList && pagination && (
										<>
											<DataTable
												ariaLabel="Danh sách hồ sơ điều tra"
												compact
												minWidthClassName="min-w-[610px]"
												selectedRowKey={selectedId}
												rows={queue.data.items}
												getRowKey={(row) => row.id}
												emptyMessage={
													<div className="mx-auto flex w-fit max-w-full flex-col items-center gap-2">
														<Inbox
															aria-hidden="true"
															className="size-10 rounded-full bg-[#edf5ed] p-2 text-[#31623d]"
														/>
														<span>
															{filters.scope !== "ALL" ||
															filters.reviewStatus ||
															filters.groupId ||
															filters.q
																? "Không có hồ sơ phù hợp với bộ lọc."
																: "Chưa có hồ sơ phản hồi."}
														</span>
													</div>
												}
												columns={[
													{
														key: "case",
														header: "Hồ sơ",
														className: "w-[25%]",
														render: (row) => (
															<button
																type="button"
																aria-expanded={selectedId === row.id}
																aria-controls={selectedId === row.id ? panelId : undefined}
																className="cursor-pointer rounded-md outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-[#2d5a27] focus-visible:after:ring-inset"
																onClick={(event) => {
																	if (saving.current) return;
																	rowTrigger.current = event.currentTarget;
																	setSelectedId(row.id);
																}}
															>
																<CaseCategory item={row} />
																<span className="sr-only">
																	{" "}
																	· {formatInvestigationDate(row.reportedAt ?? row.createdAt)}
																	{row.questionPreview && ` · ${row.questionPreview}`}
																</span>
															</button>
														),
													},
													{
														key: "question",
														header: "Câu hỏi / Ngữ cảnh",
														className: "w-[26%]",
														render: (row) =>
															row.questionPreview ? (
																<p className="line-clamp-2 text-xs leading-relaxed [overflow-wrap:anywhere]">
																	{row.questionPreview}
																</p>
															) : (
																<span className="text-xs text-[#54655a]">Không có câu hỏi</span>
															),
													},
													{
														key: "date",
														header: "Thời gian",
														render: (row) => (
															<time
																className="block min-w-[4.4rem] text-xs leading-relaxed text-[#54655a]"
																dateTime={row.reportedAt ?? row.createdAt}
															>
																{formatInvestigationDate(row.reportedAt ?? row.createdAt)}
															</time>
														),
													},
													{
														key: "review",
														header: "Xem xét",
														render: (row) =>
															row.reviewStatus ? (
																<CaseBadge status={reviewLabels[row.reviewStatus]} />
															) : (
																<span>
																	<span aria-hidden="true">—</span>
																	<span className="sr-only">Không áp dụng</span>
																</span>
															),
													},
													{
														key: "analysis",
														header: "Phân tích",
														render: (row) => (
															<CaseBadge status={processingLabels[row.processingStatus]} />
														),
													},
													{
														key: "technical",
														header: "Kỹ thuật",
														render: (row) => (
															<CaseBadge status={technicalLabels[row.technicalStatus]} />
														),
													},
												]}
											/>
											<Pagination
												currentPage={pagination.page}
												totalPages={pagination.totalPages}
												totalItems={pagination.total}
												itemsPerPage={pagination.limit}
												onPageChange={(page) => changeFilters({ ...filters, page })}
											/>
											{pagination.totalPages <= 1 && pagination.total > 0 && (
												<p className="text-xs font-semibold text-[#54655a]">
													Tổng cộng {pagination.total} hồ sơ
												</p>
											)}
										</>
									)}
								</section>
							</div>
						</div>
					</div>
					{selectedId && (
						<section
							id={panelId}
							aria-labelledby={`${panelId}-heading`}
							ref={panel}
							className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-sm min-[1360px]:sticky min-[1360px]:top-4 min-[1360px]:max-h-[calc(100dvh-2rem)] min-[1360px]:overflow-y-auto"
						>
							<CasePanel
								key={selectedId}
								actor={actor}
								id={selectedId}
								headingId={`${panelId}-heading`}
								saving={saving}
								onClose={() => {
									if (!saving.current) setSelectedId(null);
								}}
								onGroupOpen={(groupId) => {
									if (saving.current) return;
									setSearch("");
									changeFilters({ ...initialFilters, groupId }, true);
								}}
							/>
						</section>
					)}
				</div>
			</div>
		</AdminLayout>
	);
}
