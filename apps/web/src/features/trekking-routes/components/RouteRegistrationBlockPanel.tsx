import {
	AlertCircle,
	CheckCircle2,
	Info,
	Loader2,
	RefreshCw,
	ShieldAlert,
	XCircle,
} from "lucide-react";
import { useRouteRegistrationEligibility } from "../hooks/useRouteRegistrationEligibility";

interface RouteRegistrationBlockPanelProps {
	routeId: string;
	routeName?: string;
	onProceedBooking?: () => void;
}

function formatDateTime(value: string | null): string {
	if (!value) return "";
	return new Date(value).toLocaleString("vi-VN");
}

export function RouteRegistrationBlockPanel({
	routeId,
	routeName,
	onProceedBooking,
}: RouteRegistrationBlockPanelProps) {
	const { eligibility, isLoading, error, isBlocked, blockedReasons, assessmentTime, reload } =
		useRouteRegistrationEligibility(routeId);

	return (
		<div
			className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm"
			data-testid="route-registration-block-panel"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="font-extrabold text-[#10221b] text-base">
						Kiểm tra điều kiện đăng ký chuyến đi
					</h3>
					<p className="mt-1 text-sm text-[#667a6d]">
						Hệ thống kiểm tra rủi ro thời tiết trước khi tạo đăng ký mới (BR-072).
						{routeName ? ` Tuyến: ${routeName}` : ""}
					</p>
				</div>
				<button
					type="button"
					data-testid="btn-reload-eligibility"
					onClick={() => void reload()}
					disabled={isLoading}
					className="inline-flex items-center gap-1.5 rounded-xl border border-[#d0e0d0] px-3 py-1.5 text-xs font-bold text-[#425048] hover:bg-[#f4f7f2] disabled:opacity-50"
				>
					<RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
					Tải lại
				</button>
			</div>

			{isLoading && (
				<div
					data-testid="registration-eligibility-loading"
					className="mt-4 flex items-center gap-2 rounded-xl bg-[#f8faf7] p-4 text-sm font-bold text-[#667a6d]"
				>
					<Loader2 className="size-4 animate-spin text-[#164027]" />
					Đang kiểm tra điều kiện an toàn thời tiết...
				</div>
			)}

			{error && !isLoading && !isBlocked && (
				<div
					role="alert"
					data-testid="registration-eligibility-error"
					className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 font-medium"
				>
					<AlertCircle className="size-5 shrink-0 text-amber-600" />
					<span>{error}</span>
				</div>
			)}

			{!isLoading && isBlocked && (
				<div
					role="alert"
					data-testid="registration-blocked-banner"
					className="mt-4 space-y-4 rounded-xl border border-red-200 bg-red-50 p-4"
				>
					<div className="flex items-start gap-3">
						<ShieldAlert className="size-6 shrink-0 text-red-600 mt-0.5" />
						<div>
							<h4 className="font-extrabold text-red-900 text-base">
								Tạm dừng nhận đăng ký chuyến đi mới (Rủi ro thời tiết MỨC ĐỎ)
							</h4>
							<p className="mt-1 text-sm font-bold text-red-800">
								Hệ thống không cho phép tạo đăng ký mới khi rủi ro thời tiết tuyến đường ở Mức Đỏ
								(BR-072).
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 bg-white/80 rounded-lg p-3 border border-red-100">
						<div>
							<span className="text-xs font-bold text-[#667a6d] uppercase tracking-wider block">
								Thời điểm đánh giá (BR-073)
							</span>
							<span data-testid="assessment-time" className="text-sm font-extrabold text-[#10221b]">
								{formatDateTime(assessmentTime) || "Vừa cập nhật"}
							</span>
						</div>
						<div>
							<span className="text-xs font-bold text-[#667a6d] uppercase tracking-wider block">
								Điểm rủi ro tổng hợp
							</span>
							<span data-testid="composite-score" className="text-sm font-extrabold text-red-700">
								{eligibility?.compositeScore?.toFixed(2) ?? "1.40"} (MỨC ĐỎ)
							</span>
						</div>
					</div>

					<div>
						<h5 className="text-xs font-extrabold text-red-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
							<Info className="size-3.5" />
							Lý do tạm dừng đăng ký (Các tiêu chí vi phạm BR-071 & BR-073):
						</h5>
						<ul data-testid="blocked-reasons-list" className="space-y-1.5">
							{blockedReasons.length > 0 ? (
								blockedReasons.map((reason) => (
									<li
										key={reason.criterion}
										data-testid={`reason-item-${reason.criterion}`}
										className="flex items-start gap-2 text-sm font-bold text-red-800 bg-red-100/60 rounded-md px-3 py-1.5"
									>
										<XCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
										<span>{reason.message}</span>
									</li>
								))
							) : (
								<li
									data-testid="reason-item-composite_score"
									className="flex items-start gap-2 text-sm font-bold text-red-800 bg-red-100/60 rounded-md px-3 py-1.5"
								>
									<XCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
									<span>Điểm rủi ro thời tiết tổng hợp vượt quá ngưỡng an toàn Mức Đỏ</span>
								</li>
							)}
						</ul>
					</div>
				</div>
			)}

			{!isLoading && !isBlocked && eligibility?.allowed && (
				<div
					data-testid="registration-allowed-badge"
					className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
				>
					<div className="flex items-center gap-2.5">
						<CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
						<div>
							<span className="font-extrabold text-emerald-900 text-sm block">
								Tuyến đường đủ điều kiện an toàn để nhận đăng ký.
							</span>
							<span className="text-xs font-bold text-emerald-700">
								Mức rủi ro: {eligibility.riskLevel.toUpperCase()} (Điểm:{" "}
								{eligibility.compositeScore.toFixed(2)})
							</span>
						</div>
					</div>
				</div>
			)}

			<div className="mt-5 flex items-center justify-end">
				<button
					type="button"
					data-testid="btn-submit-booking"
					disabled={isBlocked || isLoading}
					onClick={() => onProceedBooking?.()}
					className="flex items-center gap-2 rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition-all hover:bg-[#10301d] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
				>
					{isBlocked ? "Tạm dừng đăng ký (Rủi ro Mức Đỏ)" : "Tiến hành đăng ký chuyến đi"}
				</button>
			</div>
		</div>
	);
}
