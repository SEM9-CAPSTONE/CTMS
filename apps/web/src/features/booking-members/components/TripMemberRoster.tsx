import {
	AlertCircle,
	Check,
	CheckCheck,
	CheckCircle2,
	ChevronDown,
	ChevronsUpDown,
	CornerDownRight,
	Loader2,
	RefreshCw,
	Users,
	X,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { useToast } from "../../../shared/components/Toast";
import { useCompleteBooking } from "../../booking-completion/hooks/useCompleteBooking";
import { useCompleteTripBookings } from "../../booking-completion/hooks/useCompleteTripBookings";
import { useTripMemberRoster } from "../hooks/useTripMemberRoster";
import { useUpdateBookingMemberStatus } from "../hooks/useUpdateBookingMemberStatus";
import type {
	BookingMemberStatus,
	RosterBookingStatus,
	RosterTripStatus,
	TripRosterMember,
	UpdateBookingMemberStatusRequest,
} from "../types";

const statusPresentation: Record<BookingMemberStatus, { label: string; className: string }> = {
	registered: {
		label: "Đã đăng ký",
		className: "bg-sky-50 text-sky-800 ring-sky-200",
	},
	joined: {
		label: "Đã tham gia",
		className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
	},
	no_show: {
		label: "Không tham gia",
		className: "bg-amber-50 text-amber-900 ring-amber-200",
	},
	removed: {
		label: "Đã xóa",
		className: "bg-slate-100 text-slate-700 ring-slate-200",
	},
	left: {
		label: "Đã rời chuyến",
		className: "bg-purple-50 text-purple-800 ring-purple-200",
	},
};

const eligibleTripStatuses = new Set<RosterTripStatus>(["published", "ongoing"]);

function formatMemberTime(value: string | null): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function blockedReason(bookingStatus: RosterBookingStatus | null, tripStatus: RosterTripStatus) {
	if (!eligibleTripStatuses.has(tripStatus))
		return "Chuyến đi hiện không cho phép cập nhật điểm danh.";
	if (bookingStatus !== "confirmed")
		return "Đơn đặt chỗ hiện không đủ điều kiện cập nhật điểm danh.";
	return null;
}

function memberIdentity(member: TripRosterMember): string {
	return member.displayName?.trim() || member.email?.trim() || "Thành viên chưa cập nhật tên";
}

export interface TripMemberRosterProps {
	tripId: string;
	useRoster?: typeof useTripMemberRoster;
	useStatusMutation?: typeof useUpdateBookingMemberStatus;
	useCompleteBookingMutation?: typeof useCompleteBooking;
	useCompleteTripBookingsMutation?: typeof useCompleteTripBookings;
}

export function TripMemberRoster({
	tripId,
	useRoster = useTripMemberRoster,
	useStatusMutation = useUpdateBookingMemberStatus,
	useCompleteBookingMutation = useCompleteBooking,
	useCompleteTripBookingsMutation = useCompleteTripBookings,
}: TripMemberRosterProps) {
	const { data, isLoading, error, refetch } = useRoster(tripId);
	const mutation = useStatusMutation(refetch);
	const toast = useToast();
	const [noShowTarget, setNoShowTarget] = useState<TripRosterMember | null>(null);
	const [isBatchCompleteOpen, setIsBatchCompleteOpen] = useState(false);
	const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);

	const completeBookingMutation = useCompleteBookingMutation(async () => {
		await refetch();
	});

	const completeTripMutation = useCompleteTripBookingsMutation(async (res) => {
		toast.success(`Đã hoàn tất ${res.completedCount}/${res.totalBookings} đơn đặt chỗ.`);
		await refetch();
	});

	const members = useMemo(() => data?.members ?? [], [data?.members]);

	const [collapsedBookingIds, setCollapsedBookingIds] = useState<Set<string>>(new Set());

	interface BookingGroup {
		bookingId: string;
		primaryMember: TripRosterMember;
		bookingStatus: RosterBookingStatus | null;
		members: TripRosterMember[];
		stats: {
			total: number;
			joined: number;
			noShow: number;
			registered: number;
			isAllMarked: boolean;
		};
	}

	const bookingGroups = useMemo<BookingGroup[]>(() => {
		const map = new Map<string, TripRosterMember[]>();
		for (const m of members) {
			const list = map.get(m.bookingId) ?? [];
			list.push(m);
			map.set(m.bookingId, list);
		}
		const groups: BookingGroup[] = [];
		for (const [bookingId, groupMembers] of map.entries()) {
			const primary = groupMembers.find((m) => m.isPrimary) ?? groupMembers[0];
			const companions = groupMembers.filter((m) => m.memberId !== primary.memberId);
			const sortedMembers = [primary, ...companions];
			const joined = groupMembers.filter((m) => m.memberStatus === "joined").length;
			const noShow = groupMembers.filter((m) => m.memberStatus === "no_show").length;
			const registered = groupMembers.filter((m) => m.memberStatus === "registered").length;
			groups.push({
				bookingId,
				primaryMember: primary,
				bookingStatus: primary.bookingStatus,
				members: sortedMembers,
				stats: {
					total: groupMembers.length,
					joined,
					noShow,
					registered,
					isAllMarked: registered === 0,
				},
			});
		}
		return groups;
	}, [members]);

	const toggleCollapse = (bookingId: string) => {
		setCollapsedBookingIds((prev) => {
			const next = new Set(prev);
			if (next.has(bookingId)) {
				next.delete(bookingId);
			} else {
				next.add(bookingId);
			}
			return next;
		});
	};

	const multiMemberGroups = bookingGroups.filter((g) => g.members.length > 1);
	const allCollapsed =
		multiMemberGroups.length > 0 &&
		multiMemberGroups.every((g) => collapsedBookingIds.has(g.bookingId));

	const expandAll = () => setCollapsedBookingIds(new Set());
	const collapseAll = () =>
		setCollapsedBookingIds(new Set(multiMemberGroups.map((g) => g.bookingId)));

	const submit = async (
		member: TripRosterMember,
		status: UpdateBookingMemberStatusRequest["status"]
	) => {
		const result = await mutation.updateStatus(tripId, member.bookingId, member.memberId, status);
		if (result.response) {
			toast.success(
				status === "joined"
					? `Đã xác nhận ${memberIdentity(member)} tham gia.`
					: `Đã ghi nhận ${memberIdentity(member)} không tham gia.`
			);
		} else if (result.error) {
			const notify = result.error.kind === "conflict" ? toast.warning : toast.error;
			notify(result.error.message);
		}
	};

	const handleCompleteSingleBooking = async (bookingId: string) => {
		setCompletingBookingId(bookingId);
		const result = await completeBookingMutation.completeBooking(bookingId);
		setCompletingBookingId(null);
		if (result) {
			toast.success("Đã hoàn tất đơn đặt chỗ.");
		} else if (completeBookingMutation.error) {
			toast.error(completeBookingMutation.error.message);
		}
	};

	const handleBatchComplete = async () => {
		setIsBatchCompleteOpen(false);
		const result = await completeTripMutation.completeTripBookings(tripId);
		if (!result && completeTripMutation.error) {
			toast.error(completeTripMutation.error.message);
		}
	};

	if (isLoading && !data) {
		return (
			<section
				aria-label="Danh sách thành viên chuyến đi"
				className="mt-8 flex items-center justify-center gap-3 rounded-3xl border border-[#dfe8df] bg-white p-10 text-sm font-semibold text-[#55685a] shadow-sm"
			>
				<Loader2 className="size-5 animate-spin text-[#164027]" />
				Đang tải danh sách thành viên...
			</section>
		);
	}

	if (error && !data) {
		return (
			<section
				aria-label="Danh sách thành viên chuyến đi"
				className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm"
			>
				<div role="alert" className="flex flex-col gap-4 sm:flex-row sm:items-center">
					<AlertCircle className="size-5 shrink-0" />
					<p className="flex-1 text-sm font-semibold">{error.message}</p>
					{error.canRetry && (
						<Button variant="outline" size="sm" onClick={() => void refetch()} className="gap-2">
							<RefreshCw className="size-4" /> Thử lại
						</Button>
					)}
				</div>
			</section>
		);
	}

	if (!data) return null;

	return (
		<section
			id="trip-member-roster"
			aria-label="Danh sách thành viên chuyến đi"
			className="mt-8 rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex size-11 items-center justify-center rounded-2xl bg-[#164027]/10 text-[#164027]">
						<Users className="size-5" />
					</div>
					<div>
						<h2 className="text-lg font-extrabold text-[#10221b]">Danh sách điểm danh</h2>
						<p className="text-xs text-[#667a6d]">
							{bookingGroups.length} đoàn đặt chỗ · {members.length} thành viên
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{bookingGroups.some((g) => g.members.length > 1) && (
						<Button
							variant="outline"
							size="sm"
							onClick={allCollapsed ? expandAll : collapseAll}
							className="gap-1.5"
						>
							<ChevronsUpDown className="size-4" />
							{allCollapsed ? "Mở rộng đoàn" : "Thu gọn đoàn"}
						</Button>
					)}
					{data.status === "completed" && (
						<Button
							size="sm"
							onClick={() => setIsBatchCompleteOpen(true)}
							disabled={completeTripMutation.isSubmitting || isLoading}
							className="gap-1.5 bg-[#164027] text-white hover:bg-[#0f2e1c]"
						>
							{completeTripMutation.isSubmitting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<CheckCheck className="size-4" />
							)}
							Hoàn tất tất cả đơn
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => void refetch()}
						disabled={isLoading}
						className="gap-2"
					>
						<RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} /> Tải lại
					</Button>
				</div>
			</div>

			{mutation.accessRevoked && (
				<p
					role="alert"
					className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900"
				>
					Bạn không còn quyền cập nhật danh sách này. Trạng thái hiện tại được giữ nguyên.
				</p>
			)}

			{members.length === 0 ? (
				<div className="mt-6 rounded-2xl border border-dashed border-[#d2ded3] bg-[#fbfdfb] p-10 text-center text-sm text-[#667a6d]">
					Chuyến đi chưa có thành viên trong danh sách.
				</div>
			) : (
				<div className="mt-6 overflow-hidden rounded-2xl border border-[#e5eee7] bg-white shadow-xs">
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="border-b border-[#e5eee7] bg-[#f8faf8] text-xs font-bold text-[#667a6d]">
									<th scope="col" className="py-3 px-4">
										Thành viên
									</th>
									<th scope="col" className="py-3 px-4">
										Vai trò & Đơn
									</th>
									<th scope="col" className="py-3 px-4">
										Trạng thái
									</th>
									<th scope="col" className="py-3 px-4 text-right">
										Thao tác
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#e5eee7] text-sm">
								{bookingGroups.map((group) => {
									const isMultiMember = group.members.length > 1;
									const isCollapsed = isMultiMember && collapsedBookingIds.has(group.bookingId);
									const primary = group.primaryMember;

									const primaryPresentation = statusPresentation[primary.memberStatus];
									const primaryPending = mutation.pendingMemberIds.has(primary.memberId);
									const primaryError = mutation.errors[primary.memberId];
									const primaryReason = blockedReason(primary.bookingStatus, data.status);
									const primaryActionable =
										primary.memberStatus === "registered" &&
										!primaryReason &&
										!mutation.accessRevoked;
									const primaryStatusTime =
										primary.memberStatus === "joined"
											? formatMemberTime(primary.checkedInAt)
											: primary.memberStatus === "no_show"
												? formatMemberTime(primary.noShowAt)
												: primary.memberStatus === "left"
													? formatMemberTime(primary.leftAt)
													: null;

									return (
										<Fragment key={group.bookingId}>
											{/* Primary Member Row */}
											<tr
												data-member-id={primary.memberId}
												className={`transition-colors hover:bg-[#fafcfa] ${
													isMultiMember && !isCollapsed ? "bg-[#fcfdfc]" : ""
												}`}
											>
												{/* Column 1: Thành viên */}
												<td className="py-3.5 px-4 align-middle">
													{isMultiMember ? (
														<button
															type="button"
															onClick={() => toggleCollapse(group.bookingId)}
															aria-expanded={!isCollapsed}
															className="flex items-center gap-2.5 text-left group focus:outline-none"
														>
															<div
																className={`flex size-6 shrink-0 items-center justify-center rounded-lg border border-[#d2ded3] bg-white text-[#164027] transition-transform duration-200 group-hover:border-[#164027] ${
																	isCollapsed ? "" : "rotate-180"
																}`}
																aria-hidden="true"
															>
																<ChevronDown className="size-3.5" />
															</div>
															<div className="min-w-0">
																<div className="flex flex-wrap items-center gap-2">
																	<span className="font-extrabold text-[#10221b] group-hover:text-[#164027] transition-colors">
																		{memberIdentity(primary)}
																	</span>
																	<span className="rounded-full bg-[#164027]/10 px-2 py-0.5 text-[10px] font-bold text-[#164027]">
																		Nhóm {group.members.length} người
																	</span>
																</div>
																{primary.email && (
																	<p className="text-xs text-[#667a6d] truncate mt-0.5">
																		{primary.email}
																	</p>
																)}
															</div>
														</button>
													) : (
														<div className="min-w-0">
															<p className="font-extrabold text-[#10221b]">
																{memberIdentity(primary)}
															</p>
															{primary.email && (
																<p className="text-xs text-[#667a6d] truncate mt-0.5">
																	{primary.email}
																</p>
															)}
														</div>
													)}
												</td>

												{/* Column 2: Vai trò & Đơn */}
												<td className="py-3.5 px-4 align-middle">
													<div className="flex flex-wrap items-center gap-1.5">
														<span className="rounded-full bg-[#164027]/10 px-2 py-0.5 text-[10px] font-bold text-[#164027]">
															Người đặt chính
														</span>
														{group.bookingStatus === "completed" && (
															<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200">
																Đơn đã hoàn thành
															</span>
														)}
														{isMultiMember && (
															<span className="text-[11px] font-medium text-[#667a6d]">
																({group.stats.joined + group.stats.noShow}/{group.stats.total} đã
																điểm danh)
															</span>
														)}
													</div>
													{primaryReason && primary.memberStatus === "registered" && (
														<p className="mt-1 text-[11px] font-medium text-amber-800">
															{primaryReason}
														</p>
													)}
												</td>

												{/* Column 3: Trạng thái */}
												<td className="py-3.5 px-4 align-middle">
													<div className="flex flex-col items-start gap-1">
														<span
															className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${primaryPresentation.className}`}
														>
															{primaryPresentation.label}
														</span>
														{primaryStatusTime && (
															<span className="text-[11px] font-medium text-[#7b8c82] tabular-nums whitespace-nowrap">
																{primaryStatusTime}
															</span>
														)}
													</div>
												</td>

												{/* Column 4: Thao tác */}
												<td className="py-3.5 px-4 align-middle text-right">
													<div className="flex flex-wrap items-center justify-end gap-2">
														{primaryActionable && (
															<>
																<Button
																	size="sm"
																	disabled={primaryPending}
																	onClick={() => void submit(primary, "joined")}
																	aria-label={`Đánh dấu ${memberIdentity(primary)} đã tham gia`}
																	className="gap-1 text-xs h-8 px-2.5"
																>
																	{primaryPending ? (
																		<Loader2 className="size-3 animate-spin" />
																	) : (
																		<Check className="size-3" />
																	)}
																	Đã tham gia
																</Button>
																<button
																	type="button"
																	disabled={primaryPending}
																	onClick={() => setNoShowTarget(primary)}
																	aria-label={`Đánh dấu ${memberIdentity(primary)} không tham gia`}
																	className="inline-flex items-center gap-1 rounded-xl border border-amber-300 px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
																>
																	<X className="size-3" /> Không tham gia
																</button>
															</>
														)}

														{data.status === "completed" && group.bookingStatus === "confirmed" && (
															<Button
																size="sm"
																variant="outline"
																disabled={completingBookingId === group.bookingId}
																onClick={() => void handleCompleteSingleBooking(group.bookingId)}
																aria-label={`Hoàn tất đơn đặt chỗ ${group.bookingId}`}
																className="gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs h-8 px-2.5"
															>
																{completingBookingId === group.bookingId ? (
																	<Loader2 className="size-3 animate-spin" />
																) : (
																	<CheckCircle2 className="size-3" />
																)}
																Hoàn tất đơn
															</Button>
														)}
													</div>

													{primaryPending && (
														<output className="mt-1 block text-right text-xs font-semibold text-[#164027]">
															Đang cập nhật...
														</output>
													)}
													{primaryError && (
														<div
															role="alert"
															className="mt-2 flex flex-col gap-1 rounded-xl bg-rose-50 p-2 text-left text-xs font-semibold text-rose-900"
														>
															<span>{primaryError.message}</span>
															{primaryError.canRetry && (
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() => void mutation.retry(primary.memberId)}
																	className="h-6 text-[11px] self-end"
																>
																	Thử lại
																</Button>
															)}
														</div>
													)}
												</td>
											</tr>

											{/* Companion Rows (indented, only if multi-member and not collapsed) */}
											{isMultiMember &&
												!isCollapsed &&
												group.members.slice(1).map((companion) => {
													const companionPresentation = statusPresentation[companion.memberStatus];
													const companionPending = mutation.pendingMemberIds.has(
														companion.memberId
													);
													const companionError = mutation.errors[companion.memberId];
													const companionReason = blockedReason(
														companion.bookingStatus,
														data.status
													);
													const companionActionable =
														companion.memberStatus === "registered" &&
														!companionReason &&
														!mutation.accessRevoked;
													const companionStatusTime =
														companion.memberStatus === "joined"
															? formatMemberTime(companion.checkedInAt)
															: companion.memberStatus === "no_show"
																? formatMemberTime(companion.noShowAt)
																: companion.memberStatus === "left"
																	? formatMemberTime(companion.leftAt)
																	: null;

													return (
														<tr
															key={companion.memberId}
															data-member-id={companion.memberId}
															className="bg-[#fbfcfb] transition-colors hover:bg-[#f5f9f6]"
														>
															{/* Column 1: Companion Name indented */}
															<td className="py-3 px-4 pl-10 align-middle">
																<div className="flex items-center gap-2 min-w-0">
																	<CornerDownRight className="size-3.5 text-slate-400 shrink-0" />
																	<div className="min-w-0">
																		<p className="font-semibold text-[#2d3748]">
																			{memberIdentity(companion)}
																		</p>
																		{companion.email && (
																			<p className="text-xs text-[#667a6d] truncate">
																				{companion.email}
																			</p>
																		)}
																	</div>
																</div>
															</td>

															{/* Column 2: Role */}
															<td className="py-3 px-4 align-middle">
																<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
																	Thành viên đi cùng
																</span>
																{companionReason && companion.memberStatus === "registered" && (
																	<p className="mt-1 text-[11px] font-medium text-amber-800">
																		{companionReason}
																	</p>
																)}
															</td>

															{/* Column 3: Status */}
															<td className="py-3 px-4 align-middle">
																<div className="flex flex-col items-start gap-1">
																	<span
																		className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${companionPresentation.className}`}
																	>
																		{companionPresentation.label}
																	</span>
																	{companionStatusTime && (
																		<span className="text-[11px] font-medium text-[#7b8c82] tabular-nums whitespace-nowrap">
																			{companionStatusTime}
																		</span>
																	)}
																</div>
															</td>

															{/* Column 4: Actions */}
															<td className="py-3 px-4 align-middle text-right">
																{companionActionable && (
																	<div className="flex flex-wrap items-center justify-end gap-2">
																		<Button
																			size="sm"
																			disabled={companionPending}
																			onClick={() => void submit(companion, "joined")}
																			aria-label={`Đánh dấu ${memberIdentity(companion)} đã tham gia`}
																			className="gap-1 text-xs h-8 px-2.5"
																		>
																			{companionPending ? (
																				<Loader2 className="size-3 animate-spin" />
																			) : (
																				<Check className="size-3" />
																			)}
																			Đã tham gia
																		</Button>
																		<button
																			type="button"
																			disabled={companionPending}
																			onClick={() => setNoShowTarget(companion)}
																			aria-label={`Đánh dấu ${memberIdentity(companion)} không tham gia`}
																			className="inline-flex items-center gap-1 rounded-xl border border-amber-300 px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
																		>
																			<X className="size-3" /> Không tham gia
																		</button>
																	</div>
																)}

																{companionPending && (
																	<output className="mt-1 block text-right text-xs font-semibold text-[#164027]">
																		Đang cập nhật...
																	</output>
																)}
																{companionError && (
																	<div
																		role="alert"
																		className="mt-2 flex flex-col gap-1 rounded-xl bg-rose-50 p-2 text-left text-xs font-semibold text-rose-900"
																	>
																		<span>{companionError.message}</span>
																		{companionError.canRetry && (
																			<Button
																				variant="outline"
																				size="sm"
																				onClick={() => void mutation.retry(companion.memberId)}
																				className="h-6 text-[11px] self-end"
																			>
																				Thử lại
																			</Button>
																		)}
																	</div>
																)}
															</td>
														</tr>
													);
												})}
										</Fragment>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			<ConfirmModal
				isOpen={Boolean(noShowTarget)}
				onClose={() => setNoShowTarget(null)}
				onConfirm={async () => {
					if (!noShowTarget) return;
					const target = noShowTarget;
					setNoShowTarget(null);
					await submit(target, "no_show");
				}}
				title="Xác nhận không tham gia"
				description={
					<span>
						Ghi nhận <strong>{noShowTarget ? memberIdentity(noShowTarget) : "thành viên"}</strong>{" "}
						không tham gia chuyến đi. Máy chủ sẽ kiểm tra điều kiện cuối cùng.
					</span>
				}
				confirmText="Xác nhận không tham gia"
				cancelText="Quay lại"
				variant="warning"
				isLoading={Boolean(noShowTarget && mutation.pendingMemberIds.has(noShowTarget.memberId))}
			/>

			<ConfirmModal
				isOpen={isBatchCompleteOpen}
				onClose={() => setIsBatchCompleteOpen(false)}
				onConfirm={handleBatchComplete}
				title="Hoàn tất tất cả đơn đặt chỗ"
				description={
					<span>
						Hệ thống sẽ kiểm tra và hoàn tất tất cả các đơn đặt chỗ hợp lệ thuộc chuyến đi này.
					</span>
				}
				confirmText="Xác nhận hoàn tất"
				cancelText="Quay lại"
				variant="success"
				isLoading={completeTripMutation.isSubmitting}
			/>
		</section>
	);
}
