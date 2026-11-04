import { CATEGORY_LABELS, RIGHTS_LABELS } from "../constants";
import type { SourceVersion } from "../types";
export function SourceVersionProvenance({ version }: { version: SourceVersion }) {
	const { metadata, rights } = version;
	const entries = [
		["Tổ chức xuất bản", metadata.publisher],
		["Phân loại", CATEGORY_LABELS[metadata.classification]],
		["Ngôn ngữ", metadata.locale],
		["Ngôn ngữ gốc", metadata.originalLocale],
		["Ngày xuất bản nguồn", metadata.sourcePublishedAt ?? "Chưa xác định"],
		["Ngày truy cập", metadata.retrievedAt],
		["Giấy phép", metadata.licenseType],
		["Minh chứng nguồn", metadata.permissionEvidence],
		["Ghi công nguồn", metadata.attribution],
		["Thay đổi", metadata.changeSummary],
		["Phiên bản gốc", metadata.originalVersionId ?? "—"],
		["Thông báo bản dịch", metadata.adaptationDisclaimer ?? "—"],
		["Quyền sử dụng", RIGHTS_LABELS[rights.rightsReviewStatus]],
		["Quyền xử lý AI", rights.internalRagUseAllowed ? "Đã xác minh" : "Chưa được phép"],
		[
			"Phân phối ngoại tuyến",
			rights.offlineRedistributionAllowed ? "Đã xác minh" : "Chưa được phép",
		],
		["Dịch hoặc chuyển thể", rights.translationAllowed ? "Đã xác minh" : "Chưa được phép"],
		[
			"Chuyên môn y tế",
			rights.medicalContentReviewStatus === "APPROVED" ? "Đã kiểm tra" : "Chưa xác nhận phù hợp",
		],
		["Minh chứng xét duyệt", rights.evidence || "Chưa có"],
		["Người duyệt", version.reviewedBy ?? "—"],
		["Thời gian duyệt", version.reviewedAt ?? "—"],
		["Người xuất bản", version.publishedBy ?? "—"],
		["Thời gian xuất bản", version.publishedAt ?? "—"],
		["Mã phiên bản", version.id],
		["Mã kiểm tra SHA-256", version.checksum],
		["Tệp", `${version.originalFilename} · ${version.size} byte`],
	];
	return (
		<>
			<dl className="grid gap-3 text-sm sm:grid-cols-2">
				{entries.map(([label, value]) => (
					<div key={label} className="min-w-0">
						<dt className="font-semibold text-[#667a6d]">{label}</dt>
						<dd className="break-words whitespace-pre-wrap">{value}</dd>
					</div>
				))}
			</dl>
			<div className="my-3 flex gap-4 text-sm underline">
				{metadata.sourceUrl && (
					<a href={metadata.sourceUrl} target="_blank" rel="noopener noreferrer">
						Nguồn gốc
					</a>
				)}
				{metadata.licenseUrl && (
					<a href={metadata.licenseUrl} target="_blank" rel="noopener noreferrer">
						Điều khoản gốc
					</a>
				)}
			</div>
			{version.reason && (
				<p className="rounded-lg bg-amber-50 p-3 text-sm">Lý do: {version.reason}</p>
			)}
		</>
	);
}
