import { levelName } from "../constants";
import type { LevelDecision } from "../types";

export function LevelReviewHistory({ items }: { items: LevelDecision[] }) {
	return (
		<section className="space-y-3">
			<h3 className="text-sm font-semibold">Lịch sử xét cấp</h3>
			{items.length === 0 && (
				<p className="text-sm text-muted-foreground">Chưa có quyết định xét cấp.</p>
			)}
			{items.map((item) => (
				<details key={item.id} className="border-b border-border py-3 text-sm">
					<summary className="cursor-pointer font-semibold">
						{item.outcome === "approved" ? "Đã công nhận" : "Không công nhận"}:{" "}
						{item.outcome === "approved"
							? `${item.fromLevel ? levelName(item.fromLevel) : "Chưa xác nhận"} → ${levelName(item.toLevel)}`
							: levelName(item.toLevel)}
						<span className="ml-2 font-normal text-muted-foreground">
							{new Date(item.decidedAt).toLocaleString("vi-VN", {
								dateStyle: "short",
								timeStyle: "short",
							})}
						</span>
					</summary>
					{item.outcome === "rejected" && (
						<p className="mt-2 text-muted-foreground">Giữ nguyên cấp hiện tại.</p>
					)}
					<p className="mt-2 whitespace-pre-wrap">Lý do: {item.reason}</p>
					<p className="mt-1 text-muted-foreground">
						{item.actorName ?? "Quản trị viên"} · {item.routeName ?? "Tuyến được xét cấp"}
					</p>
					<details className="mt-3">
						<summary className="cursor-pointer text-muted-foreground">
							Hồ sơ và tiêu chí lúc xét cấp
						</summary>
						<div className="mt-2 space-y-1 text-muted-foreground">
							<p>
								Nguồn: {item.source === "request" ? "Yêu cầu nâng cấp" : "Điều chỉnh trực tiếp"}
							</p>
							{item.porterReason && <p>Lý do đề nghị: {item.porterReason}</p>}
							<p>
								Tiêu chí: {item.policySnapshot.definition.name} · phiên bản{" "}
								{item.policySnapshot.version}
							</p>
							<p>
								Kinh nghiệm tối thiểu:{" "}
								{item.policySnapshot.definition.minExperienceYears ?? "Chưa đạt"}; số lần dẫn tối
								thiểu: {item.policySnapshot.definition.minTimesLed ?? "Chưa đạt"}.
							</p>
							<p>
								Kỹ năng: {item.policySnapshot.definition.requiredSkills.join(", ") || "Chưa đạt"}
							</p>
							<p>
								Chứng chỉ:{" "}
								{item.policySnapshot.definition.requiredCertifications.join(", ") || "Chưa đạt"}
							</p>
							<p className="whitespace-pre-wrap">
								Phạm vi: {item.policySnapshot.definition.responsibilities}
							</p>
							<p>
								Hồ sơ: {item.dossierSnapshot.experienceYears} năm; {item.dossierSnapshot.timesLed}{" "}
								lần dẫn tuyến.
							</p>
							<p>Kỹ năng đã khai: {item.dossierSnapshot.skills.join(", ") || "Chưa khai"}</p>
							<p>
								Chứng chỉ đã khai: {item.dossierSnapshot.certifications.join(", ") || "Chưa khai"}
							</p>
							{item.evidenceSnapshot?.map((file) => (
								<details key={file.id}>
									<summary>Minh chứng: {file.fileName}</summary>
									<p className="break-all text-xs">SHA-256: {file.checksum}</p>
								</details>
							))}
						</div>
					</details>
				</details>
			))}
		</section>
	);
}
