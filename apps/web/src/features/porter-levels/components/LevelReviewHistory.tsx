import { levelName } from "../constants";
import type { LevelDecision } from "../types";

const CERT_LABELS: Record<string, string> = {
	wfa: "Sơ cứu nơi hoang dã (WFA)",
	rescue: "Cứu hộ địa hình / Leo núi",
	guide_card: "Thẻ hướng dẫn viên du lịch",
};

function formatCert(codeOrName: string): string {
	return CERT_LABELS[codeOrName.trim().toLowerCase()] ?? codeOrName;
}

export function LevelReviewHistory({ items }: { items: LevelDecision[] }) {
	return (
		<section className="space-y-3">
			<h3 className="text-xs font-semibold uppercase tracking-wide text-[#53674d]">
				Lịch sử xét cấp
			</h3>
			{items.length === 0 && <p className="text-xs text-[#667a6d]">Chưa có quyết định xét cấp.</p>}
			{items.map((item) => {
				const def = item.policySnapshot.definition;
				const minTrips = def.minCompletedTrips ?? def.minTimesLed;
				return (
					<details key={item.id} className="rounded-xl bg-[#f8faf7] px-4 py-3 text-sm">
						<summary className="cursor-pointer text-xs font-semibold text-[#10221b]">
							{item.outcome === "approved" ? "Đã công nhận" : "Không công nhận"}:{" "}
							{item.outcome === "approved"
								? `${item.fromLevel ? levelName(item.fromLevel) : "Chưa xác nhận"} → ${levelName(item.toLevel)}`
								: levelName(item.toLevel)}
							<span className="ml-2 font-normal text-[#667a6d]">
								·{" "}
								{new Date(item.decidedAt).toLocaleString("vi-VN", {
									dateStyle: "short",
									timeStyle: "short",
								})}
							</span>
						</summary>
						{item.outcome === "rejected" && (
							<p className="mt-2 text-xs text-[#667a6d]">Giữ nguyên cấp hiện tại.</p>
						)}
						<p className="mt-2 whitespace-pre-wrap text-xs text-[#10221b]">Lý do: {item.reason}</p>
						<p className="mt-1 text-[11px] text-[#667a6d]">
							Người xét duyệt: {item.actorName ?? "Quản trị viên"}
						</p>
						<details className="mt-2.5">
							<summary className="cursor-pointer text-xs font-medium text-[#53674d]">
								Hồ sơ và tiêu chí lúc xét cấp
							</summary>
							<div className="mt-2 space-y-1 text-xs text-[#4a5e51]">
								<p>
									Nguồn: {item.source === "request" ? "Yêu cầu nâng cấp" : "Điều chỉnh trực tiếp"}
								</p>
								{item.porterReason && <p>Lý do đề nghị: {item.porterReason}</p>}
								<p>Tiêu chí áp dụng: {def.name}</p>
								<p>
									Kinh nghiệm tối thiểu: {def.minExperienceYears ?? "Không yêu cầu"}
									{def.minExperienceYears != null ? " năm" : ""} · Tổng chuyến tối thiểu:{" "}
									{minTrips != null ? `${minTrips} chuyến` : "Không yêu cầu"}
									{def.minTotalKm != null ? ` · Tổng quãng đường: ${def.minTotalKm} km` : ""}
								</p>
								{def.requiredSkills.length > 0 && (
									<p>Kỹ năng bắt buộc: {def.requiredSkills.join(", ")}</p>
								)}
								{def.requiredCertifications.length > 0 && (
									<p>Chứng chỉ bắt buộc: {def.requiredCertifications.map(formatCert).join(", ")}</p>
								)}
								<p className="whitespace-pre-wrap">Phạm vi phụ trách: {def.responsibilities}</p>
								<p>
									Hồ sơ lúc xét: {item.dossierSnapshot.experienceYears} năm kinh nghiệm ·{" "}
									{item.dossierSnapshot.timesLed} chuyến
								</p>
								<p>Kỹ năng đã khai: {item.dossierSnapshot.skills.join(", ") || "Chưa cập nhật"}</p>
								<p>
									Chứng chỉ đã khai:{" "}
									{item.dossierSnapshot.certifications.length > 0
										? item.dossierSnapshot.certifications.map(formatCert).join(", ")
										: "Chưa cập nhật"}
								</p>
								{item.evidenceSnapshot?.map((file) => (
									<p key={file.id} className="text-[11px] text-[#667a6d]">
										Minh chứng đính kèm: {file.fileName}
									</p>
								))}
							</div>
						</details>
					</details>
				);
			})}
		</section>
	);
}
