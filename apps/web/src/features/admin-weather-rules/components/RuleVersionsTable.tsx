import { CheckCircle2, Play, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Pagination } from "../../../shared/components";
import type { WeatherRiskRuleItem } from "../types";

interface RuleVersionsTableProps {
	rules: WeatherRiskRuleItem[];
	onActivateClick: (rule: WeatherRiskRuleItem) => void;
	isActivating?: boolean;
}

const ITEMS_PER_PAGE = 5;

export function RuleVersionsTable({
	rules,
	onActivateClick,
	isActivating = false,
}: RuleVersionsTableProps) {
	const [currentPage, setCurrentPage] = useState(1);

	const formatDate = (dateStr: string) => {
		try {
			return new Date(dateStr).toLocaleString("vi-VN", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return dateStr;
		}
	};

	if (rules.length === 0) {
		return (
			<div data-testid="empty-rules-list" className="p-12 text-center space-y-3">
				<ShieldAlert className="mx-auto size-10 text-[#9aaba0]" />
				<p className="font-bold text-[#10221b] text-base">Chưa có lịch sử phiên bản quy tắc</p>
				<p className="text-sm text-[#667a6d]">
					Hệ thống chưa tạo phiên bản quy tắc rủi ro thời tiết nào. Hãy bấm "Tạo phiên bản mới".
				</p>
			</div>
		);
	}

	const totalPages = Math.ceil(rules.length / ITEMS_PER_PAGE);
	const safeCurrentPage = Math.min(currentPage, totalPages);
	const paginatedRules = rules.slice(
		(safeCurrentPage - 1) * ITEMS_PER_PAGE,
		safeCurrentPage * ITEMS_PER_PAGE
	);

	return (
		<div>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm" data-testid="rules-versions-table">
					<thead className="bg-[#f4f8f4] text-xs font-black uppercase text-[#425048] border-b border-[#e0ebe0]">
						<tr>
							<th className="px-5 py-4">Phiên bản</th>
							<th className="px-5 py-4">Trạng thái</th>
							<th className="px-5 py-4">Trọng số tiêu chí (Mưa/Gió/Nhiệt/Tầm nhìn/Dông)</th>
							<th className="px-5 py-4">Điểm trần (Green/Yellow)</th>
							<th className="px-5 py-4">Thời gian tạo</th>
							<th className="px-5 py-4 text-right">Thao tác</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-[#e8efe8] font-bold text-[#10221b]">
						{paginatedRules.map((rule) => (
							<tr
								key={rule.id}
								data-testid={`rule-row-${rule.version}`}
								className={`transition-colors ${rule.isActive ? "bg-emerald-50/40" : "hover:bg-[#f9fbf9]"}`}
							>
								<td className="px-5 py-4 font-black">
									<span className="text-[#164027] text-base">v{rule.version}</span>
								</td>

								<td className="px-5 py-4">
									{rule.isActive ? (
										<span
											data-testid={`active-status-badge-${rule.version}`}
											className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1 text-xs font-black text-white"
										>
											<CheckCircle2 className="size-3.5" />
											ĐANG ÁP DỤNG
										</span>
									) : (
										<span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 border border-gray-200">
											Không hoạt động
										</span>
									)}
								</td>

								<td className="px-5 py-4 text-xs font-medium text-[#54655a]">
									<span>{(rule.rainfallWeight * 100).toFixed(0)}%</span> /{" "}
									<span>{(rule.windWeight * 100).toFixed(0)}%</span> /{" "}
									<span>{(rule.temperatureWeight * 100).toFixed(0)}%</span> /{" "}
									<span>{(rule.visibilityWeight * 100).toFixed(0)}%</span> /{" "}
									<span>{(rule.thunderstormWeight * 100).toFixed(0)}%</span>
								</td>

								<td className="px-5 py-4 text-xs font-semibold text-[#10221b]">
									<span>≤ {rule.greenMaxScore}</span> / <span>≤ {rule.yellowMaxScore}</span>
								</td>

								<td className="px-5 py-4 text-xs font-medium text-[#54655a]">
									{formatDate(rule.createdAt)}
								</td>

								<td className="px-5 py-4 text-right">
									{!rule.isActive ? (
										<button
											type="button"
											data-testid={`btn-activate-rule-${rule.version}`}
											disabled={isActivating}
											onClick={() => onActivateClick(rule)}
											className="inline-flex items-center gap-1.5 rounded-xl border border-[#164027]/20 bg-white px-3 py-1.5 text-xs font-bold text-[#164027] shadow-sm transition-all hover:bg-[#eef7f0] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<Play className="size-3.5 text-[#164027]" />
											Kích hoạt phiên bản này
										</button>
									) : (
										<span className="text-xs font-bold text-[#164027]">Đang áp dụng</span>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="px-6 pb-4">
					<Pagination
						currentPage={safeCurrentPage}
						totalPages={totalPages}
						totalItems={rules.length}
						itemsPerPage={ITEMS_PER_PAGE}
						onPageChange={(page) => setCurrentPage(page)}
					/>
				</div>
			)}
		</div>
	);
}
