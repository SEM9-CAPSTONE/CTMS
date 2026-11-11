import { Loader2 } from "lucide-react";
import { DemandPlanningCard } from "./DemandPlanningCard";
import { panelClass, reportStamp } from "./constants";
import type { DemandPlanningReport, DemandPlanningStatus } from "./types";
import { planningError } from "./useDemandPlanning";

interface DemandPlanningSectionProps {
	data?: DemandPlanningReport;
	status?: DemandPlanningStatus;
	isLoading?: boolean;
	error?: unknown;
}

export function DemandPlanningSection({
	data,
	status,
	isLoading,
	error,
}: DemandPlanningSectionProps) {
	if (isLoading) {
		return (
			<section className={`${panelClass} py-6 text-center`} aria-live="polite">
				<p className="text-sm text-[#526357]">Đang tải gợi ý tổ chức chuyến…</p>
			</section>
		);
	}

	if (error) {
		return (
			<section className={`${panelClass} py-6 text-center`} role="alert">
				<p className="text-sm text-[#526357]">{planningError(error)}</p>
			</section>
		);
	}

	if (status === "not_requested") {
		return (
			<section className={panelClass}>
				<p className="text-sm leading-6 text-[#526357]">
					Bạn có thể xem thêm gợi ý chi tiết về khoảng giá, sức chứa và thời lượng dựa trên dữ liệu
					đặt chỗ đã chốt bằng nút “Gợi ý tổ chức chuyến” ở thanh tác vụ phía trên.
				</p>
			</section>
		);
	}

	if (status === "pending" || status === "running") {
		return (
			<section className={`${panelClass} py-8 text-center`} aria-live="polite">
				<h2 className="text-base font-bold text-[#164027]">
					Đang tạo gợi ý tổ chức chuyến. Trang sẽ tự cập nhật.
				</h2>
				<p className="mt-1 text-sm text-[#526357]">
					Hệ thống đang phân tích các nhóm nhu cầu đã chốt để đưa ra gợi ý phù hợp.
				</p>
				<Loader2 className="mx-auto mt-4 size-5 animate-spin text-[#164027]" aria-hidden="true" />
			</section>
		);
	}

	if (status === "failed") {
		return (
			<section className={`${panelClass} py-6 text-center`} role="alert">
				<h2 className="font-bold text-[#10221b]">
					Chưa thể tạo gợi ý tổ chức chuyến cho tháng này.
				</h2>
			</section>
		);
	}

	if (status === "unavailable") {
		return (
			<section className={`${panelClass} py-6 text-center`}>
				<p className="text-sm text-[#526357]">
					Chưa hỗ trợ gợi ý tổ chức chuyến cho kỳ báo cáo này.
				</p>
			</section>
		);
	}

	if (status === "withheld") {
		return (
			<section className={`${panelClass} py-6 text-center`}>
				<p className="text-sm text-[#526357]">
					Gợi ý tổ chức chuyến không còn được hiển thị để bảo vệ thông tin.
				</p>
			</section>
		);
	}

	if (status === "succeeded") {
		if (!data?.recommendations || data.recommendations.length === 0) {
			return (
				<section className={`${panelClass} py-6 text-center`}>
					<p className="text-sm text-[#526357]">Không có gợi ý nào cho tháng này.</p>
				</section>
			);
		}

		return (
			<section aria-labelledby="demand-planning-heading" className={panelClass}>
				<h2 id="demand-planning-heading" className="text-lg font-bold">
					Gợi ý tổ chức chuyến
				</h2>
				<p className="mt-2 text-sm leading-6 text-[#526357]">
					Đối chiếu các gợi ý này với tuyến và năng lực tổ chức của bạn. Các thông số phản ánh dữ
					liệu đã ghi nhận từ các lượt đặt chỗ trong kỳ.
				</p>
				<div className="mt-4 grid items-stretch gap-4 sm:grid-cols-2">
					{data.recommendations.map((rec) => (
						<DemandPlanningCard key={rec.candidateId} rec={rec} />
					))}
				</div>

				{data.generatedAt && (
					<p className="mt-4 text-xs leading-6 text-[#526357]">
						Gợi ý chốt lúc {reportStamp(data.generatedAt)}
						{data.stale ? ". Dữ liệu có thể khác hiện tại." : ""}
					</p>
				)}
			</section>
		);
	}

	return null;
}
