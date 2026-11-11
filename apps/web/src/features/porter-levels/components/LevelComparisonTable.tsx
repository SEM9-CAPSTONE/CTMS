import type { ReviewContext } from "../types";
export function LevelComparisonTable({ context }: { context: ReviewContext }) {
	const { dossier, policy } = context;
	if (!policy) return <p role="alert">Admin cần cấu hình tiêu chí của cấp này trước khi duyệt.</p>;
	const rows = [
		[
			"Kinh nghiệm",
			`${dossier.experienceYears} năm`,
			policy.definition.minExperienceYears ?? "Chưa đặt",
		],
		["Dẫn tuyến", `${dossier.timesLed} lần (tự khai)`, policy.definition.minTimesLed ?? "Chưa đặt"],
		[
			"Kỹ năng tự khai",
			dossier.skills.join(", ") || "Chưa khai",
			policy.definition.requiredSkills.join(", ") || "Chưa đặt",
		],
		[
			"Chứng chỉ tự khai",
			dossier.certifications.join(", ") || "Chưa khai",
			policy.definition.requiredCertifications.join(", ") || "Chưa đặt",
		],
	];
	return (
		<div className="space-y-3">
			<p className="text-sm font-bold">
				Đối chiếu với {policy.definition.name} · phiên bản {policy.version}
			</p>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm">
					<thead>
						<tr>
							{["Tiêu chí", "Hồ sơ Porter", "Yêu cầu của cấp đích"].map((heading) => (
								<th key={heading} className="p-2">
									{heading}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map(([label, actual, required]) => (
							<tr key={label} className="border-t border-[#dfe8df]">
								<th scope="row" className="p-2 font-medium">
									{label}
								</th>
								<td className="p-2">{actual}</td>
								<td className="p-2">{required}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p className="whitespace-pre-wrap text-sm">
				Phạm vi phụ trách: {policy.definition.responsibilities}
			</p>
			<p className="text-sm text-[#627769]">
				Đối chiếu hỗ trợ Admin đánh giá, không tự đổi cấp. Admin kiểm tra bằng chứng và ghi lý do
				cho quyết định cuối cùng.
			</p>
		</div>
	);
}
