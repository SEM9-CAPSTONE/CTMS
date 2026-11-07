import { Loader2 } from "lucide-react";
import { DemandNextSteps } from "./DemandNextSteps";
import { DemandPlanningSection } from "./DemandPlanningSection";
import { DemandSuggestions } from "./DemandSuggestions";
import {
	activeStatus,
	difficultyLabels,
	monthLabel,
	panelClass,
	reportStamp,
	tripLabels,
} from "./constants";
import type { DemandPlanningReport, DemandPlanningStatus, DemandReport } from "./types";

interface DemandResultsProps {
	report: DemandReport;
	planning?: {
		data?: DemandPlanningReport;
		status?: DemandPlanningStatus;
		isLoading?: boolean;
		error?: unknown;
	};
}

export function DemandResults({ report, planning }: DemandResultsProps) {
	const messages = {
		pending: ["Đang tạo báo cáo. Trang sẽ tự cập nhật.", ""],
		running: ["Đang tạo báo cáo. Trang sẽ tự cập nhật.", ""],
		failed: [
			report.canRetry
				? "Chưa tạo được báo cáo. Bạn có thể thử lại một lượt."
				: "Chưa tạo được báo cáo. Đã dừng xử lý cho tháng này.",
			"",
		],
		insufficient_data: ["Tháng này chưa đủ dữ liệu để hiển thị.", ""],
		withheld: ["Báo cáo tháng này không còn được hiển thị để bảo vệ thông tin người đặt.", ""],
	};
	const sameBand =
		report.cells.length > 1 &&
		report.cells.every(
			(cell) =>
				cell.bookerBand.min === report.cells[0].bookerBand.min &&
				cell.bookerBand.max === report.cells[0].bookerBand.max
		);
	return (
		<>
			{report.status === "succeeded" ? (
				<section aria-labelledby="demand-summary">
					<h2 id="demand-summary" className="text-lg font-bold">
						{monthLabel(report.month).replace("Tháng 0", "Tháng ")} có {report.cells.length} loại
						chuyến đủ dữ liệu để hiển thị
					</h2>
					<div className="mt-4 grid items-stretch gap-4 sm:grid-cols-2">
						{report.cells.map((cell) => (
							<article className={panelClass} key={`${cell.tripType}-${cell.difficulty}`}>
								<h3 className="font-semibold">
									Chuyến {tripLabels[cell.tripType].toLowerCase()}
									{cell.difficulty ? ` · ${difficultyLabels[cell.difficulty]}` : ""}
								</h3>
								<p className="mt-3 text-2xl font-bold text-[#164027]">
									{cell.bookerBand.min}–{cell.bookerBand.max}{" "}
									<span className="text-sm font-normal">người đã đặt</span>
								</p>
							</article>
						))}
					</div>
					<p className="mt-3 text-sm leading-6 text-[#526357]">
						{sameBand &&
							`Các nhóm cùng ở mức ${report.cells[0].bookerBand.min}–${report.cells[0].bookerBand.max} nên chưa thể so sánh nhóm nào nhiều hơn. `}
						Số người hiển thị theo khoảng để bảo vệ người đặt. Đây là số đã đặt chỗ, không phải dự
						báo.
					</p>
				</section>
			) : (
				<section className={`${panelClass} py-10 text-center`} aria-live="polite">
					<h2 className="font-bold">{messages[report.status][0]}</h2>
					<p className="mx-auto mt-2 max-w-xl text-sm text-[#526357]">
						{messages[report.status][1]}
					</p>
					{activeStatus(report.status) && (
						<Loader2
							className="mx-auto mt-4 size-5 animate-spin text-[#164027]"
							aria-hidden="true"
						/>
					)}
				</section>
			)}
			{planning?.status !== "succeeded" && <DemandSuggestions report={report} />}
			{report.status === "succeeded" && planning && (
				<DemandPlanningSection
					data={planning.data}
					status={planning.status}
					isLoading={planning.isLoading}
					error={planning.error}
				/>
			)}
			{(report.status === "succeeded" ||
				report.status === "insufficient_data" ||
				report.status === "withheld") && (
				<DemandNextSteps limited={report.status !== "succeeded"} />
			)}
			{report.status === "succeeded" && report.generatedAt && (
				<p className="text-xs leading-6 text-[#526357]">
					Số liệu chốt lúc {reportStamp(report.generatedAt)}
					{report.stale ? ". Có thể khác dữ liệu hiện tại." : ""}
				</p>
			)}
		</>
	);
}
