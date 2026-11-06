import { difficultyLabels, panelClass, tripLabels } from "./constants";
import type { DemandReport } from "./types";

export function DemandSuggestions({ report }: { report: DemandReport }) {
	if (report.status !== "succeeded") return null;
	// Display only released groups explicitly selected by the provider, in cell order rather than rank order.
	const suggestions = report.cells.flatMap((cell) => {
		const suggestion = report.suggestions.find(
			(item) => item.tripType === cell.tripType && item.difficulty === cell.difficulty
		);
		return suggestion ? [{ cell, reason: suggestion.reason }] : [];
	});
	if (!suggestions.length) return null;
	return (
		<section aria-labelledby="demand-suggestions" className={panelClass}>
			<h2 id="demand-suggestions" className="text-lg font-bold">
				Gợi ý tổ chức chuyến
			</h2>
			<p className="mt-2 text-sm leading-6 text-[#526357]">
				Đối chiếu các gợi ý này với tuyến và khả năng tổ chức của bạn trước khi quyết định. Các gợi
				ý không được xếp hạng ưu tiên.
			</p>
			<p className="mt-2 text-xs leading-5 text-[#526357]">
				AI chọn nhóm có nhu cầu; câu chữ do hệ thống viết sẵn.
			</p>
			<div className="mt-4 grid items-stretch gap-4 sm:grid-cols-2">
				{suggestions.map(({ cell, reason }) => (
					<article
						key={`${cell.tripType}-${cell.difficulty}`}
						className="rounded-xl border border-[#dfe8df] bg-[#f4f7f2] p-4"
					>
						<h3 className="font-semibold text-[#164027]">
							Có thể cân nhắc: Chuyến {tripLabels[cell.tripType].toLowerCase()}
							{cell.difficulty ? ` · ${difficultyLabels[cell.difficulty]}` : ""}
						</h3>

						<p className="mt-2 text-sm leading-6 text-[#526357]">
							{reason === "observed_booking_interest"
								? "Bạn có thể tham khảo nhu cầu đã ghi nhận khi cân nhắc kế hoạch tổ chức."
								: "Đây là một lựa chọn tham khảo khi lên kế hoạch, không đảm bảo sẽ có người đặt trong tương lai."}
						</p>
					</article>
				))}
			</div>
		</section>
	);
}
