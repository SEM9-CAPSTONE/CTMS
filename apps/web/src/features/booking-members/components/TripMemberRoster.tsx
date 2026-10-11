import {
	AlertCircle,
	Check,
	CheckCheck,
	CheckCircle2,
	ChevronDown,
	ChevronsUpDown,
	Loader2,
	RefreshCw,
	Users,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
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
			const joined = groupMembers.filter((m) => m.memberStatus === "joined").length;
			const noShow = groupMembers.filter((m) => m.memberStatus === "no_show").length;
			const registered = groupMembers.filter((m) => m.memberStatus === "registered").length;
			groups.push({
				bookingId,
				primaryMember: primary,
				bookingStatus: primary.bookingStatus,
				members: groupMembers,
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

	const allCollapsed =
		bookingGroups.length > 0 && collapsedBookingIds.size === bookingGroups.length;

	const expandAll = () => setCollapsedBookingIds(new Set());
	const collapseAll = () => setCollapsedBookingIds(new Set(bookingGroups.map((g) => g.bookingId)));

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
					{bookingGroups.length > 1 && (
						<Button
							variant="outline"
							size="sm"
							onClick={allCollapsed ? expandAll : collapseAll}
							className="gap-1.5"
						>
							<ChevronsUpDown className="size-4" />
							{allCollapsed ? "Mở rộng tất cả" : "Thu gọn tất cả"}
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
				<div className="mt-6 flex flex-col gap-4">
					{bookingGroups.map((group, groupIdx) => {
						const isCollapsed = collapsedBookingIds.has(group.bookingId);
						const primaryName = memberIdentity(group.primaryMember);
						const isMultiMember = group.members.length > 1;

						return (
							<div
								key={group.bookingId}
								className="overflow-hidden rounded-2xl border border-[#e5eee7] bg-white shadow-xs transition-colors hover:border-[#cfdece]"
							>
								{/* Accordion / Collapsible Header */}
								<div className="flex flex-col gap-3 bg-[#f8faf8] p-4 transition-colors sm:flex-row sm:items-center sm:justify-between">
									{/* Left side: Group Title & Toggle Button */}
									<button
										type="button"
										onClick={() => toggleCollapse(group.bookingId)}
										aria-expanded={!isCollapsed}
										className="flex flex-1 items-center gap-3 min-w-0 text-left transition-opacity hover:opacity-80 focus:outline-none"
									>
										<div
											className={`flex size-8 shrink-0 items-center justify-center rounded-xl bg-white border border-[#d2ded3] text-[#164027] transition-transform duration-200 ${
												isCollapsed ? "" : "rotate-180"
											}`}
											aria-hidden="true"
										>
											<ChevronDown className="size-4" />
										</div>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-sm font-extrabold text-[#10221b] truncate">
													Đoàn {groupIdx + 1}: {primaryName}
												</span>
												<span className="rounded-full bg-[#164027]/10 px-2 py-0.5 text-[11px] font-bold text-[#164027] whitespace-nowrap">
													{isMultiMember ? `Nhóm ${group.members.length} người` : "1 người"}
												</span>
												{group.bookingStatus === "completed" && (
													<span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200 whitespace-nowrap">
														Đơn đã hoàn thành
													</span>
												)}
											</div>
											{group.primaryMember.email && (
												<p className="text-xs text-[#667a6d] truncate mt-0.5">
													Liên hệ: {group.primaryMember.email}
												</p>
											)}
										</div>
									</button>

									{/* Right side: Attendance Status & Single Complete Button */}
									<div
										className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0"
										onClick={(e) => e.stopPropagation()}
									>
										<span
											className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
												group.stats.isAllMarked
													? "bg-emerald-50 text-emerald-800 ring-emerald-200"
													: "bg-sky-50 text-sky-800 ring-sky-200"
											}`}
										>
											{group.stats.isAllMarked
												? `Đã điểm danh đủ ${group.stats.total}/${group.stats.total}`
												: `Đã điểm danh: ${group.stats.joined + group.stats.noShow}/${group.stats.total}`}
										</span>

										{data.status === "completed" && group.bookingStatus === "confirmed" && (
											<Button
												size="sm"
												variant="outline"
												disabled={completingBookingId === group.bookingId}
												onClick={() => void handleCompleteSingleBooking(group.bookingId)}
												aria-label={`Hoàn tất đơn đặt chỗ ${group.bookingId}`}
												className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
											>
												{completingBookingId === group.bookingId ? (
													<Loader2 className="size-3.5 animate-spin" />
												) : (
													<CheckCircle2 className="size-3.5" />
												)}
												Hoàn tất đơn
											</Button>
										)}
									</div>
								</div>

								{/* Collapsible Content: Members list */}
								{!isCollapsed && (
									<ul className="divide-y divide-[#e5eee7] border-t border-[#e5eee7]">
										{group.members.map((member) => {
											const presentation = statusPresentation[member.memberStatus];
											const pending = mutation.pendingMemberIds.has(member.memberId);
											const memberError = mutation.errors[member.memberId];
											const reason = blockedReason(member.bookingStatus, data.status);
											const actionable =
												member.memberStatus === "registered" && !reason && !mutation.accessRevoked;
											const statusTime =
												member.memberStatus === "joined"
													? formatMemberTime(member.checkedInAt)
													: member.memberStatus === "no_show"
														? formatMemberTime(member.noShowAt)
														: member.memberStatus === "left"
															? formatMemberTime(member.leftAt)
															: null;

											return (
												<li
													key={member.memberId}
													data-member-id={member.memberId}
													className="p-4 sm:p-5 transition-colors hover:bg-[#fafcfa]"
												>
													<div className="flex flex-col gap-4 lg:flex-row lg:items-center">
														<div className="min-w-0 flex-1">
															<div className="flex flex-wrap items-center gap-2">
																<p className="truncate font-extrabold text-[#10221b]">
																	{memberIdentity(member)}
																</p>
																{member.isPrimary ? (
																	<span className="rounded-full bg-[#164027]/10 px-2 py-0.5 text-[10px] font-bold text-[#164027]">
																		Người đặt chính
																	</span>
																) : (
																	<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
																		Thành viên đi cùng
																	</span>
																)}
															</div>
															{member.displayName && member.email && (
																<p className="mt-1 truncate text-xs text-[#667a6d]">
																	{member.email}
																</p>
															)}
															{reason && member.memberStatus === "registered" && (
																<p className="mt-2 text-xs font-medium text-amber-800">{reason}</p>
															)}
														</div>

														<div className="flex flex-col items-start gap-1 lg:items-end shrink-0">
															<div className="flex flex-wrap items-center gap-2">
																<span
																	className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${presentation.className}`}
																>
																	{presentation.label}
																</span>

																{actionable && (
																	<div className="flex flex-wrap gap-2">
																		<Button
																			size="sm"
																			disabled={pending}
																			onClick={() => void submit(member, "joined")}
																			aria-label={`Đánh dấu ${memberIdentity(member)} đã tham gia`}
																			className="gap-1.5"
																		>
																			{pending ? (
																				<Loader2 className="size-3.5 animate-spin" />
																			) : (
																				<Check className="size-3.5" />
																			)}
																			Đã tham gia
																		</Button>
																		<button
																			type="button"
																			disabled={pending}
																			onClick={() => setNoShowTarget(member)}
																			aria-label={`Đánh dấu ${memberIdentity(member)} không tham gia`}
																			className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
																		>
																			<X className="size-3.5" /> Không tham gia
																		</button>
																	</div>
																)}
															</div>

															{statusTime && (
																<span className="text-[11px] font-medium text-[#7b8c82] tabular-nums whitespace-nowrap">
																	{statusTime}
																</span>
															)}
														</div>
													</div>

													{pending && (
														<output className="mt-3 block text-xs font-semibold text-[#164027]">
															Đang cập nhật trạng thái...
														</output>
													)}
													{memberError && (
														<div
															role="alert"
															className="mt-3 flex flex-col gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-900 sm:flex-row sm:items-center"
														>
															<span className="flex-1">{memberError.message}</span>
															{memberError.canRetry && (
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() => void mutation.retry(member.memberId)}
																>
																	Thử lại
																</Button>
															)}
														</div>
													)}
												</li>
											);
										})}
									</ul>
								)}
							</div>
						);
					})}
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
