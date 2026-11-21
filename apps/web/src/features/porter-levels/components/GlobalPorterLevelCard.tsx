import { AlertTriangle, Bell, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { Button, StatusBadge } from "../../../shared/components";
import { LEVEL_CODES, levelName, levelReviewError } from "../constants";
import { useLevelNotifications } from "../hooks/useLevelRequests";
import { useMyGlobalPorterLevel } from "../hooks/usePorterLevels";
import type { PorterLevel } from "../types";

const LEVEL_FALLBACK_LABELS: Record<PorterLevel, string> = {
	learning: "Học việc",
	proficient: "Thành thạo",
	expert: "Chuyên gia",
};

const CERT_LABELS: Record<string, string> = {
	wfa: "Sơ cứu nơi hoang dã (WFA)",
	rescue: "Cứu hộ địa hình / Leo núi",
	guide_card: "Thẻ hướng dẫn viên",
	other: "Chứng chỉ khác",
};

function certDisplayName(codeOrName: string): string {
	return CERT_LABELS[codeOrName.trim().toLowerCase()] ?? codeOrName;
}

function levelTone(level: PorterLevel): "neutral" | "info" | "success" {
	if (level === "expert") return "success";
	if (level === "proficient") return "info";
	return "neutral";
}

export function GlobalPorterLevelCard() {
	const overviewQuery = useMyGlobalPorterLevel();
	const notifications = useLevelNotifications();
	const data = overviewQuery.data;

	if (overviewQuery.isPending) {
		return (
			<section className="rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs">
				<div className="h-5 w-48 animate-pulse rounded bg-[#edf2ed]" />
				<div className="mt-4 grid gap-4 sm:grid-cols-4">
					{["s1", "s2", "s3", "s4"].map((k) => (
						<div key={k} className="h-16 animate-pulse rounded-xl bg-[#f4f7f2]" />
					))}
				</div>
			</section>
		);
	}

	if (overviewQuery.isError) {
		return (
			<section
				role="alert"
				className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 text-sm text-rose-900"
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<span>{levelReviewError(overviewQuery.error)}</span>
					<Button variant="outline" size="sm" onClick={() => void overviewQuery.refetch()}>
						Thử lại
					</Button>
				</div>
			</section>
		);
	}

	if (!data) return null;

	const policies = data.levels
		.map((l) => l.policy)
		.filter((p): p is NonNullable<typeof p> => Boolean(p));
	const currentLabel =
		levelName(data.currentLevel, policies) || LEVEL_FALLBACK_LABELS[data.currentLevel];
	const nextEval = data.nextLevelEvaluation;
	const nextLabel = data.nextLevel
		? levelName(data.nextLevel, policies) || LEVEL_FALLBACK_LABELS[data.nextLevel]
		: null;
	const missingItems = nextEval?.comparison?.missingItems ?? [];
	const unreadCount = notifications.query.data?.filter((n) => !n.readAt).length ?? 0;

	return (
		<section
			data-testid="global-porter-level-card"
			className="rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs space-y-6"
		>
			{/* Tầng 1: Tiêu đề + Huy hiệu cấp bậc tổng quát + Làm mới */}
			<div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#edf2ed] pb-5">
				<div className="space-y-1">
					<p className="text-xs font-medium tracking-wide text-[#53674d]">Cấp bậc hiện tại</p>
					<div className="flex flex-wrap items-center gap-2.5">
						<h2 className="text-2xl font-bold tracking-tight text-[#10221b]">{currentLabel}</h2>
						<StatusBadge tone={levelTone(data.currentLevel)}>
							{data.currentLevel === "expert"
								? "Cấp cao nhất"
								: nextLabel
									? `Tiếp theo: ${nextLabel}`
									: "Đang hoạt động"}
						</StatusBadge>
					</div>
				</div>

				<Button
					variant="outline"
					size="sm"
					disabled={overviewQuery.isFetching}
					onClick={() => {
						void overviewQuery.refetch();
						void notifications.query.refetch();
					}}
					className="gap-1.5 rounded-xl"
				>
					<RefreshCw
						className={`size-3.5 ${overviewQuery.isFetching ? "animate-spin" : ""}`}
						aria-hidden="true"
					/>
					<span>Cập nhật tiến độ</span>
				</Button>
			</div>

			{/* Tầng 2: 4 chỉ số tích lũy tổng quát (thuần typography, không chèn icon trang trí) */}
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<div className="rounded-xl bg-[#f8faf7] p-4">
					<p className="text-xs font-medium text-[#53674d]">Chuyến đã hoàn thành</p>
					<p className="mt-1.5 text-2xl font-bold tracking-tight text-[#10221b]">
						{data.metrics.completedTrips}
						<span className="ml-1 text-xs font-normal text-[#667a6d]">chuyến</span>
					</p>
					<p className="mt-0.5 text-xs text-[#667a6d]">
						{data.metrics.distinctRoutesCount > 1
							? `Trên ${data.metrics.distinctRoutesCount} tuyến trekking`
							: "Tính từ toàn bộ hành trình"}
					</p>
				</div>

				<div className="rounded-xl bg-[#f8faf7] p-4">
					<p className="text-xs font-medium text-[#53674d]">Tổng quãng đường đã dẫn</p>
					<p className="mt-1.5 text-2xl font-bold tracking-tight text-[#10221b]">
						{data.metrics.totalKmLed}
						<span className="ml-1 text-xs font-normal text-[#667a6d]">km</span>
					</p>
					<p className="mt-0.5 text-xs text-[#667a6d]">Tính từ các chuyến hoàn thành</p>
				</div>

				<div className="rounded-xl bg-[#f8faf7] p-4">
					<p className="text-xs font-medium text-[#53674d]">Điểm đánh giá trung bình</p>
					<p className="mt-1.5 text-2xl font-bold tracking-tight text-[#10221b]">
						{data.metrics.averageRating.toFixed(1)}★
					</p>
					<p className="mt-0.5 text-xs text-[#667a6d]">
						{data.metrics.reviewCount > 0
							? `Từ ${data.metrics.reviewCount} lượt đánh giá`
							: "Chưa có lượt đánh giá mới"}
					</p>
				</div>

				<div className="rounded-xl bg-[#f8faf7] p-4">
					<p className="text-xs font-medium text-[#53674d]">Chứng chỉ hợp lệ</p>
					<p className="mt-1.5 text-2xl font-bold tracking-tight text-[#10221b]">
						{data.metrics.verifiedCertificatesCount}
						<span className="ml-1 text-xs font-normal text-[#667a6d]">chứng chỉ</span>
					</p>
					<p className="mt-0.5 text-xs text-[#667a6d]">Đã xác minh & còn hạn</p>
				</div>
			</div>

			{/* Tầng 3: Lộ trình 3 cấp Học việc → Thành thạo → Chuyên gia */}
			<div className="space-y-4 border-t border-[#edf2ed] pt-5">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="text-sm font-semibold text-[#10221b]">Lộ trình thăng cấp</h3>
					<div className="flex items-center gap-2 text-xs">
						{LEVEL_CODES.map((code, idx) => {
							const isCurrent = code === data.currentLevel;
							const currentRank = LEVEL_CODES.indexOf(data.currentLevel);
							const isPassed = idx < currentRank;
							const label = levelName(code, policies) || LEVEL_FALLBACK_LABELS[code];
							return (
								<span
									key={code}
									className={`rounded-full px-3 py-1 font-semibold ${
										isCurrent
											? "bg-[#164027] text-white"
											: isPassed
												? "bg-emerald-50 text-[#164027]"
												: "bg-[#f3f6f2] text-[#667a6d]"
									}`}
								>
									{idx + 1}. {label}
								</span>
							);
						})}
					</div>
				</div>

				{nextEval && nextLabel && (
					<div className="space-y-3 rounded-xl bg-[#f8faf7] p-4">
						<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
							<span className="font-semibold text-[#10221b]">
								Tiến độ đạt tiêu chí cấp {nextLabel}
							</span>
							<span className="font-bold text-[#164027]">{nextEval.progressPercent}%</span>
						</div>
						<div className="h-2 w-full overflow-hidden rounded-full bg-[#e3ece3]">
							<div
								className="h-full rounded-full bg-[#164027] transition-all duration-300"
								style={{ width: `${nextEval.progressPercent}%` }}
							/>
						</div>

						{/* Danh sách các tiêu chí còn thiếu hoặc đã đạt */}
						{nextEval.comparison?.allMet ? (
							<div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900">
								<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
								<p className="leading-relaxed">
									<strong>Bạn đã đạt đủ toàn bộ tiêu chí lên cấp {nextLabel}.</strong> Quản trị viên
									sẽ xem xét hoặc bạn có thể gửi yêu cầu nâng cấp bên dưới.
								</p>
							</div>
						) : (
							missingItems.length > 0 && (
								<div className="space-y-2 pt-1">
									<p className="text-xs font-semibold text-amber-900">
										Các tiêu chí bạn còn thiếu ({missingItems.length}):
									</p>
									<ul className="grid gap-2 sm:grid-cols-2">
										{missingItems.map((item) => (
											<li
												key={`${item.code}-${item.label}`}
												className="flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-xs"
											>
												{item.code === "pending_cert" ? (
													<Clock className="mt-0.5 size-3.5 shrink-0 text-sky-700" />
												) : (
													<AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
												)}
												<div className="min-w-0">
													<p className="font-semibold text-[#10221b]">{item.label}</p>
												</div>
											</li>
										))}
									</ul>
								</div>
							)
						)}

						{/* Chi tiết chứng chỉ yêu cầu cho cấp tiếp theo */}
						{nextEval.policy && nextEval.policy.definition.requiredCertifications.length > 0 && (
							<div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
								<span className="font-medium text-[#53674d]">Chứng chỉ yêu cầu:</span>
								{nextEval.policy.definition.requiredCertifications.map((reqCode) => {
									const detail = nextEval.comparison?.certificateDetails?.find(
										(c) => c.reqCode === reqCode
									);
									const isMet = detail?.met === true;
									return (
										<span
											key={reqCode}
											className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
												isMet ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
											}`}
										>
											{isMet ? "✓" : "!"} {certDisplayName(reqCode)}
										</span>
									);
								})}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Tầng 4: Cảnh báo & Thông báo từ Quản trị viên */}
			{(data.alerts.some((a) => a.type === "cert_expired" || a.type === "cert_expiring") ||
				(notifications.query.data && notifications.query.data.length > 0)) && (
				<div className="space-y-3 border-t border-[#edf2ed] pt-5">
					<div className="flex items-center justify-between gap-2">
						<h3 className="flex items-center gap-2 text-sm font-semibold text-[#10221b]">
							<Bell className="size-4 text-[#164027]" aria-hidden="true" />
							<span>Thông báo xét cấp & nhắc bổ sung</span>
							{unreadCount > 0 && <StatusBadge tone="warning">{unreadCount} mới</StatusBadge>}
						</h3>
					</div>

					<ul className="space-y-2">
						{data.alerts
							.filter((a) => a.type === "cert_expired" || a.type === "cert_expiring")
							.map((alert) => (
								<li
									key={`${alert.type}-${alert.title}`}
									className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-950"
								>
									<p className="font-semibold">{alert.title}</p>
									<p className="mt-0.5 text-amber-900">{alert.message}</p>
								</li>
							))}

						{notifications.query.data?.slice(0, 5).map((item) => (
							<li
								key={item.id}
								className={`flex flex-wrap items-start justify-between gap-3 rounded-xl px-4 py-3 text-xs ${
									item.readAt ? "bg-[#f8faf7] text-[#53674d]" : "bg-[#edf4e8] text-[#10221b]"
								}`}
							>
								<div className="min-w-0 flex-1 space-y-0.5">
									<p className="font-semibold">
										{item.payload.routeName || "Cấp bậc tổng quát"} ·{" "}
										{levelName(item.payload.level as PorterLevel, policies) ||
											LEVEL_FALLBACK_LABELS[item.payload.level as PorterLevel] ||
											item.payload.level}
									</p>
									<p className="leading-relaxed">{item.payload.reason}</p>
									<p className="text-[11px] text-[#667a6d]">
										{new Date(item.createdAt).toLocaleString("vi-VN")}
									</p>
								</div>
								{!item.readAt && (
									<Button
										variant="outline"
										size="sm"
										disabled={notifications.read.isPending}
										onClick={() => notifications.read.mutate(item.id)}
									>
										Đã đọc
									</Button>
								)}
							</li>
						))}

						{notifications.query.data?.slice(0, 5).map((item) => (
							<li
								key={item.id}
								className={`flex flex-wrap items-start justify-between gap-3 rounded-xl px-4 py-3 text-xs ${
									item.readAt ? "bg-[#f8faf7] text-[#53674d]" : "bg-[#edf4e8] text-[#10221b]"
								}`}
							>
								<div className="min-w-0 flex-1 space-y-0.5">
									<p className="font-semibold">
										Xét duyệt cấp bậc ·{" "}
										{levelName(item.payload.level as PorterLevel, policies) ||
											LEVEL_FALLBACK_LABELS[item.payload.level as PorterLevel] ||
											item.payload.level}
									</p>
									<p className="leading-relaxed">{item.payload.reason}</p>
									<p className="text-[11px] text-[#667a6d]">
										{new Date(item.createdAt).toLocaleString("vi-VN")}
									</p>
								</div>
								{!item.readAt && (
									<Button
										variant="outline"
										size="sm"
										disabled={notifications.read.isPending}
										onClick={() => notifications.read.mutate(item.id)}
									>
										Đã đọc
									</Button>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}
