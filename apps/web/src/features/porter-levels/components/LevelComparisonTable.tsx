import { DataTable } from "../../../shared/components";
import type { GlobalPorterLevelOverview, ReviewContext } from "../types";

const CERT_LABELS: Record<string, string> = {
	wfa: "Sơ cứu nơi hoang dã (WFA)",
	rescue: "Cứu hộ địa hình / Leo núi",
	guide_card: "Thẻ hướng dẫn viên du lịch",
};

function formatCertLabel(codeOrName: string): string {
	return CERT_LABELS[codeOrName.trim().toLowerCase()] ?? codeOrName;
}

export function LevelComparisonTable({
	context,
	globalOverview,
}: {
	context: ReviewContext;
	globalOverview?: GlobalPorterLevelOverview | null;
}) {
	const { dossier, policy } = context;
	if (!policy)
		return (
			<p role="alert" className="text-sm text-amber-800">
				Chưa có tiêu chí cho cấp này.
			</p>
		);

	const def = policy.definition;
	const minTrips = def.minCompletedTrips ?? def.minTimesLed;
	const actualTrips = globalOverview ? globalOverview.metrics.completedTrips : dossier.timesLed;

	const actualCertText = globalOverview
		? globalOverview.metrics.verifiedCertificatesCount > 0
			? `${globalOverview.metrics.verifiedCertificatesCount} chứng chỉ đã xác minh`
			: "Chưa có chứng chỉ hợp lệ"
		: dossier.certifications.length > 0
			? dossier.certifications.map(formatCertLabel).join(", ")
			: "Chưa cập nhật";

	const rows = [
		minTrips != null
			? {
					label: "Tổng chuyến hoàn thành",
					actual: `${actualTrips} chuyến`,
					required: `${minTrips} chuyến`,
				}
			: null,
		def.minTotalKm != null
			? {
					label: "Tổng quãng đường đã dẫn",
					actual: globalOverview ? `${globalOverview.metrics.totalKmLed} km` : "0 km",
					required: `${def.minTotalKm} km`,
				}
			: null,
		def.minAverageRating != null
			? {
					label: "Điểm đánh giá trung bình",
					actual: globalOverview
						? `${globalOverview.metrics.averageRating.toFixed(1)}★ (${globalOverview.metrics.reviewCount} lượt)`
						: "Chưa có đánh giá",
					required: `>= ${def.minAverageRating}★`,
				}
			: null,
		def.minExperienceYears != null
			? {
					label: "Kinh nghiệm",
					actual: `${dossier.experienceYears} năm`,
					required: `${def.minExperienceYears} năm`,
				}
			: null,
		def.requiredCertifications.length > 0
			? {
					label: "Chứng chỉ bắt buộc",
					actual: actualCertText,
					required: def.requiredCertifications.map(formatCertLabel).join(", "),
				}
			: null,
		def.requiredSkills.length > 0
			? {
					label: "Kỹ năng bắt buộc",
					actual: dossier.skills.join(", ") || "Chưa cập nhật",
					required: def.requiredSkills.join(", "),
				}
			: null,
	].filter((row): row is { label: string; actual: string; required: string } => row !== null);

	return (
		<details className="rounded-xl bg-[#f8faf7] px-4 py-2.5 text-sm">
			<summary className="cursor-pointer py-1 text-xs font-semibold text-[#164027]">
				Đối chiếu với {def.name}
			</summary>
			<div className="mt-2.5 pb-1">
				{rows.length ? (
					<DataTable
						ariaLabel="Đối chiếu hồ sơ người hỗ trợ"
						rows={rows}
						getRowKey={(row) => row.label}
						minWidthClassName="min-w-[480px]"
						columns={[
							{ key: "label", header: "Tiêu chí", render: (row) => row.label },
							{ key: "actual", header: "Hồ sơ", render: (row) => row.actual },
							{ key: "required", header: "Yêu cầu", render: (row) => row.required },
						]}
					/>
				) : (
					<p className="text-xs text-[#667a6d]">Chưa có yêu cầu cụ thể cho cấp này.</p>
				)}
			</div>
		</details>
	);
}
