import { levelName } from "../constants";
import type { LevelDecision } from "../types";

export function LevelReviewHistory({ items }: { items: LevelDecision[] }) {
	return (
		<section className="space-y-3">
			<h3 className="font-bold">Lịch sử xét cấp</h3>
			{items.length === 0 && <p className="text-sm text-[#627769]">Chưa có quyết định xét cấp.</p>}
			{items.map((item) => (
				<details key={item.id} className="rounded-xl border border-[#dfe8df] p-3 text-sm">
					<summary className="cursor-pointer font-semibold">
						{item.outcome === "approved" ? "Đã duyệt" : "Từ chối"}:{" "}
						{item.fromLevel ? levelName(item.fromLevel) : "Chưa duyệt"} →{" "}
						{item.policySnapshot.definition.name} ·{" "}
						{new Date(item.decidedAt).toLocaleString("vi-VN")}
					</summary>
					<p className="mt-2 whitespace-pre-wrap">Lý do: {item.reason}</p>
					<p>Người duyệt: {item.actorName ?? "Quản trị viên"}</p>
					<p>Tuyến: {item.routeName ?? "Tuyến được xét cấp"}</p>
					<p>Nguồn: {item.source === "request" ? "Yêu cầu của Porter" : "Admin chủ động"}</p>
					{item.porterReason && <p>Lý do của Porter: {item.porterReason}</p>}
					{item.evidenceSnapshot?.map((file) => (
						<details key={file.id} className="mt-2">
							<summary>Minh chứng: {file.fileName}</summary>
							<p className="break-all text-xs">Mã kiểm tra SHA-256: {file.checksum}</p>
						</details>
					))}
					<p>
						Tiêu chí áp dụng: {item.policySnapshot.definition.name} · phiên bản{" "}
						{item.policySnapshot.version}
					</p>
					<p>
						Kinh nghiệm tối thiểu: {item.policySnapshot.definition.minExperienceYears ?? "Chưa đặt"}
						; số lần dẫn tối thiểu: {item.policySnapshot.definition.minTimesLed ?? "Chưa đặt"}.
					</p>
					<p>Kỹ năng: {item.policySnapshot.definition.requiredSkills.join(", ") || "Chưa đặt"}</p>
					<p>
						Chứng chỉ:{" "}
						{item.policySnapshot.definition.requiredCertifications.join(", ") || "Chưa đặt"}
					</p>
					<p className="whitespace-pre-wrap">
						Phạm vi: {item.policySnapshot.definition.responsibilities}
					</p>
					<p>
						Hồ sơ tại thời điểm duyệt: {item.dossierSnapshot.experienceYears} năm;{" "}
						{item.dossierSnapshot.timesLed} lần dẫn tuyến.
					</p>
					<p>Kỹ năng đã khai: {item.dossierSnapshot.skills.join(", ") || "Chưa khai"}</p>
					<p>Chứng chỉ đã khai: {item.dossierSnapshot.certifications.join(", ") || "Chưa khai"}</p>
				</details>
			))}
		</section>
	);
}
