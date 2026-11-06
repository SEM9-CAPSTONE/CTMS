import { BarChart3, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { HttpError } from "../../core/api/httpClient";
import { DemandResults } from "./DemandResults";
import { buttonClass, formatDate, monthLabel, panelClass } from "./constants";
import { demandError, useDemandInsights } from "./useDemandInsights";
export function DemandInsightsPage({ actor }: { actor: string }) {
	const [selected, setSelected] = useState("");
	const state = useDemandInsights(actor, selected);
	const month = state.month;
	const period = state.periods.data?.periods.find((item) => item.month === month);
	const error = state.report.error;
	const missing = error instanceof HttpError && error.status === 404;
	const report = state.report.isError ? undefined : state.report.data;
	const refreshing = state.report.isFetching || state.periods.isFetching;
	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="sticky top-[65px] z-20 border-b lg:top-0 border-[#dfe8df] bg-white">
				<div className="mx-auto flex min-h-20 max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
					<div className="hidden rounded-xl bg-emerald-50 p-3 text-[#164027] sm:block">
						<BarChart3 className="size-6" />
					</div>
					<div>
						<h1 className="text-xl font-extrabold sm:text-2xl">Nhu cầu đặt chỗ theo tháng</h1>
						<p className="mt-1 text-sm leading-6 text-[#526357]">
							Số người đã đặt chuyến trên toàn hệ thống (tất cả chủ chuyến), không riêng chuyến của
							bạn.
						</p>
					</div>
				</div>
			</header>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
				<section className={panelClass}>
					<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
						<label className="min-w-48 flex-1 text-sm font-semibold" htmlFor="demand-month">
							Tháng
							<select
								id="demand-month"
								value={month}
								onChange={(event) => {
									setSelected(event.target.value);
									state.create.reset();
								}}
								className="mt-2 block w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-3 font-normal"
								disabled={state.periods.isPending || state.create.isPending}
							>
								<option value="" disabled>
									Chọn tháng
								</option>
								{state.periods.data?.periods.map((item) => (
									<option
										key={item.month}
										value={item.month}
										disabled={!item.canCreate && !item.hasReport}
									>
										{monthLabel(item.month)}
										{!item.canCreate && !item.hasReport
											? ` (từ ngày ${formatDate(item.availableAt)})`
											: ""}
									</option>
								))}
							</select>
						</label>
						<button
							type="button"
							className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-4 py-3 text-sm font-semibold disabled:opacity-40 sm:w-auto"
							aria-label="Làm mới báo cáo"
							title="Làm mới báo cáo"
							aria-busy={refreshing}
							disabled={refreshing || state.create.isPending}
							onClick={() => {
								void state.periods.refetch();
								if (month) void state.report.refetch();
							}}
						>
							<RefreshCw
								className={`size-5 ${refreshing ? "animate-spin" : ""}`}
								aria-hidden="true"
							/>
							<span>{refreshing ? "Đang tải…" : "Làm mới"}</span>
						</button>
						{((missing && period) || report?.canRetry) && (
							<button
								type="button"
								className={`${buttonClass} w-full sm:w-auto`}
								disabled={
									(!report?.canRetry && !period?.canCreate) ||
									state.create.isPending ||
									state.waitSeconds > 0
								}
								onClick={state.submit}
							>
								<Sparkles className="size-4" />
								{state.create.isPending
									? "Đang gửi…"
									: report?.canRetry
										? "Thử lại báo cáo"
										: "Tạo báo cáo"}
							</button>
						)}
					</div>
				</section>

				{state.periods.isError && <p role="alert">{demandError(state.periods.error)}</p>}
				{state.create.isError &&
					state.create.variables === month &&
					!(state.create.error instanceof HttpError && state.create.error.status === 429) && (
						<p role="alert" className={`${panelClass} text-sm text-[#526357]`}>
							{demandError(state.create.error)}
						</p>
					)}
				{state.waitSeconds > 0 && (
					<output className="block text-sm text-amber-900">
						Vui lòng đợi {state.waitSeconds} giây rồi thử lại.
					</output>
				)}
				{(state.periods.isPending || (month && state.report.isPending)) && (
					<output className={`block ${panelClass}`}>Đang tải báo cáo…</output>
				)}
				{missing && (
					<section className={`${panelClass} py-10 text-center`}>
						<h2 className="font-bold">
							{period && !period.canCreate
								? `Báo cáo tháng này sẽ tạo được từ ${formatDate(period.availableAt)}.`
								: "Chưa có báo cáo cho tháng này."}
						</h2>
					</section>
				)}
				{state.report.isError && !missing && (
					<section className={panelClass} role="alert">
						{demandError(error)}
					</section>
				)}
				{report && <DemandResults report={report} />}
			</div>
		</div>
	);
}
