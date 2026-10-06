import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Footprints,
	Loader2,
	RefreshCw,
	ShieldAlert,
	ShieldCheck,
	User,
} from "lucide-react";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { PROFICIENCY_LABELS } from "../constants";
import { useRoutePorterQualifications } from "../hooks/useRoutePorterQualifications";
import type { RoutePorterQualification } from "../types";

interface RoutePorterQualificationsPanelProps {
	routeId: string;
	routeName?: string;
}

export function RoutePorterQualificationsPanel({
	routeId,
	routeName,
}: RoutePorterQualificationsPanelProps) {
	const currentUser = getStoredAuthUser();
	const {
		qualifications,
		isLoading,
		verifyingId,
		errorMessage,
		successMessage,
		conflictMessage,
		reload,
		verifyQualification,
	} = useRoutePorterQualifications(routeId);

	return (
		<section
			data-testid="route-porter-qualifications-panel"
			className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs sm:p-6"
		>
			{/* Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#e7eee7] pb-4">
				<div>
					<div className="flex items-center gap-2">
						<ShieldCheck className="size-5 text-[#164027]" />
						<h3 className="text-base font-extrabold text-[#10221b]">
							Đánh giá & Xác minh chứng chỉ Porter của tuyến
						</h3>
					</div>
					<p className="mt-0.5 text-xs text-[#627769]">
						{routeName ? `Tuyến: ${routeName}. ` : ""}
						Chỉ Host sở hữu tuyến hoặc Admin mới có quyền xác minh Porter đạt chuẩn dẫn đoàn.
					</p>
				</div>
				<button
					type="button"
					onClick={reload}
					disabled={isLoading}
					aria-label="Làm mới danh sách Porter"
					className="flex size-8 items-center justify-center rounded-xl border border-[#d2ded2] text-[#4a5e51] hover:bg-[#f4f7f2]"
				>
					<RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
				</button>
			</div>

			{/* Alert Messages */}
			{successMessage && (
				<div
					data-testid="verify-success-alert"
					className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900 animate-in fade-in"
				>
					<CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
					<span>{successMessage}</span>
				</div>
			)}

			{conflictMessage && (
				<div
					data-testid="verify-conflict-alert"
					className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900"
				>
					<AlertCircle size={15} className="shrink-0 text-amber-600" />
					<span>{conflictMessage}</span>
				</div>
			)}

			{errorMessage && (
				<div
					data-testid="verify-error-alert"
					className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-900"
				>
					<AlertCircle size={15} className="shrink-0 text-red-600" />
					<span>{errorMessage}</span>
				</div>
			)}

			{/* Content */}
			<div className="mt-4">
				{isLoading && qualifications.length === 0 ? (
					<div
						data-testid="route-qualifications-loading"
						className="flex items-center justify-center gap-2 py-8 text-xs font-bold text-[#627769]"
					>
						<Loader2 size={16} className="animate-spin text-[#164027]" />
						<span>Đang tải danh sách Porter đã đăng ký...</span>
					</div>
				) : qualifications.length === 0 ? (
					<div
						data-testid="route-qualifications-empty"
						className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d2ded2] bg-[#f9fbf9] p-8 text-center"
					>
						<User className="size-10 text-[#8fa096]" />
						<p className="mt-2 text-xs font-extrabold text-[#10221b]">
							Chưa có Porter nào đăng ký chứng chỉ cho tuyến này
						</p>
						<p className="mt-0.5 text-[11px] text-[#627769]">
							Khi Porter đăng ký năng lực cho tuyến, thông tin sẽ xuất hiện tại đây để xem xét xác
							minh.
						</p>
					</div>
				) : (
					<div
						data-testid="route-qualifications-table"
						className="overflow-x-auto rounded-xl border border-[#dfe8df]"
					>
						<table className="w-full text-left text-xs">
							<thead className="bg-[#f4f7f2] text-[10px] font-extrabold uppercase tracking-wider text-[#4a5e51]">
								<tr>
									<th className="px-4 py-3">Porter</th>
									<th className="px-4 py-3">Trình độ</th>
									<th className="px-4 py-3">Số lần dẫn</th>
									<th className="px-4 py-3">Trạng thái</th>
									<th className="px-4 py-3">Thời điểm xác minh</th>
									<th className="px-4 py-3 text-right">Thao tác</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#e7eee7] bg-white font-medium text-[#10221b]">
								{qualifications.map((row: RoutePorterQualification) => {
									const isVerified = Boolean(row.verifiedBy && row.verifiedAt);
									const isSelf = currentUser && currentUser.id === row.porterId;
									const isRowVerifying = verifyingId === row.qualificationId;

									return (
										<tr
											key={row.qualificationId}
											data-testid={`route-porter-row-${row.qualificationId}`}
											className="hover:bg-[#f9fbf9] transition-colors"
										>
											<td className="px-4 py-3">
												<div className="flex items-center gap-2">
													<div className="flex size-7 items-center justify-center rounded-full bg-[#eef7f0] text-[#164027]">
														<User size={14} />
													</div>
													<div>
														<p className="font-extrabold text-[#10221b]">
															{row.porterDisplayName || `Porter #${row.porterId.slice(0, 8)}`}
														</p>
														<p className="text-[10px] text-[#788c7e]">ID: {row.porterId}</p>
													</div>
												</div>
											</td>
											<td className="px-4 py-3">
												<span className="font-bold text-[#164027]">
													{PROFICIENCY_LABELS[row.proficiency]}
												</span>
											</td>
											<td className="px-4 py-3">
												<span className="flex items-center gap-1 font-bold">
													<Footprints size={13} className="text-[#627769]" />
													{row.timesLed} lần
												</span>
											</td>
											<td className="px-4 py-3">
												{isVerified ? (
													<span
														data-testid="row-verified-badge"
														className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800"
													>
														<CheckCircle2 size={12} className="text-emerald-600" />
														<span>Đã xác minh</span>
													</span>
												) : (
													<span
														data-testid="row-unverified-badge"
														className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-extrabold text-amber-800"
													>
														<AlertCircle size={12} className="text-amber-600" />
														<span>Chưa xác minh</span>
													</span>
												)}
											</td>
											<td className="px-4 py-3 text-[11px] text-[#627769]">
												{isVerified && row.verifiedAt ? (
													<span className="flex items-center gap-1">
														<Clock size={12} />
														{new Date(row.verifiedAt).toLocaleDateString("vi-VN", {
															year: "numeric",
															month: "short",
															day: "numeric",
															hour: "2-digit",
															minute: "2-digit",
														})}
													</span>
												) : (
													<span className="text-[#8fa096]">—</span>
												)}
											</td>
											<td className="px-4 py-3 text-right">
												{isVerified ? (
													<span className="text-[11px] font-bold text-[#8fa096]">Đã chuẩn hóa</span>
												) : isSelf ? (
													<span
														title="Không được tự xác minh chứng chỉ của chính mình"
														className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8fa096]"
													>
														<ShieldAlert size={12} />
														Tự xác minh (Bị chặn)
													</span>
												) : (
													<button
														type="button"
														disabled={isRowVerifying || Boolean(verifyingId)}
														onClick={() => verifyQualification(row.qualificationId, row.version)}
														data-testid={`verify-btn-${row.qualificationId}`}
														className="inline-flex items-center gap-1 rounded-xl bg-[#164027] px-3 py-1.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-[#205234] disabled:cursor-not-allowed disabled:opacity-50"
													>
														{isRowVerifying ? (
															<>
																<Loader2 size={13} className="animate-spin" />
																<span>Đang xác minh...</span>
															</>
														) : (
															<>
																<CheckCircle2 size={13} />
																<span>Xác minh</span>
															</>
														)}
													</button>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</section>
	);
}
