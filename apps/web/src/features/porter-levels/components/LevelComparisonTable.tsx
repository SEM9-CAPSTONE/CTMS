import { DataTable } from "../../../shared/components";
import type { ReviewContext } from "../types";

export function LevelComparisonTable({ context }: { context: ReviewContext }) {
	const { dossier, policy } = context;
	if (!policy)
		return (
			<p role="alert" className="text-sm text-amber-800">
				Chưa có tiêu chí cho cấp này.
			</p>
		);
	const rows = [
		{
			label: "Kinh nghiệm",
			actual: `${dossier.experienceYears} năm`,
			required:
				policy.definition.minExperienceYears == null
					? "Chưa đạt"
					: `${policy.definition.minExperienceYears} năm`,
		},
		{
			label: "Số lần dẫn tuyến",
			actual: `${dossier.timesLed} lần (tự khai)`,
			required:
				policy.definition.minTimesLed == null ? "Chưa đạt" : `${policy.definition.minTimesLed} lần`,
		},
		{
			label: "Kỹ năng",
			actual: dossier.skills.join(", ") || "Chưa khai",
			required: policy.definition.requiredSkills.join(", ") || "Chưa đạt",
		},
		{
			label: "Chứng chỉ",
			actual: dossier.certifications.join(", ") || "Chưa khai",
			required: policy.definition.requiredCertifications.join(", ") || "Chưa đạt",
		},
	].filter((row) => row.required !== "Chưa đạt");
	return (
		<details className="text-sm">
			<summary className="cursor-pointer py-2 font-semibold text-[#164027]">
				Đối chiếu với {policy.definition.name}
			</summary>
			<div className="mt-2 space-y-3">
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
					<p className="text-muted-foreground">Chưa có yêu cầu cụ thể cho cấp này.</p>
				)}
			</div>
		</details>
	);
}
