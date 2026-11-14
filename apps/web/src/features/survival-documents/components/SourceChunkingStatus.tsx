import { Button } from "../../../shared/components";
import { useSourceChunking } from "../hooks/useSourceChunking";
import type { ChunkSetStatus } from "../types";

const labels: Record<ChunkSetStatus, string> = {
	PENDING: "Đang chờ xử lý",
	RUNNING: "Đang xử lý tài liệu",
	READY: "Tri thức đã sẵn sàng",
	FAILED: "Xử lý thất bại",
	NEEDS_REVIEW: "PDF cần chỉnh sửa",
	OBSOLETE: "Bộ đoạn trích không còn hiệu lực",
};

const extractionIssues: Record<string, string> = {
	missing_critical_pdf_text:
		"Thiếu nội dung quan trọng khi trích xuất. Hãy tải lên bản PDF có văn bản có thể chọn.",
	pdf_conversion_incomplete:
		"Không đọc được đầy đủ nội dung PDF. Hãy tải lên một phiên bản đã sửa.",
	pdf_page_count_mismatch:
		"Không trích xuất được đủ số trang. Hãy kiểm tra và tải lại tài liệu dưới dạng phiên bản mới.",
	low_extraction_confidence:
		"Không trích xuất được văn bản hoặc bảng một cách tin cậy. Hãy kiểm tra bản PDF.",
};

export function SourceChunkingStatus({
	documentId,
	versionId,
	eligible,
	blockedReason,
	busy,
}: {
	documentId: string;
	versionId: string;
	eligible: boolean;
	blockedReason?: string | null;
	busy: boolean;
}) {
	const { query, retry } = useSourceChunking(documentId, versionId);
	const set = query.data?.find((item) => item.active) ?? query.data?.[0];
	const status = set?.status;
	const title = () => {
		if (query.isPending) return "Đang tải trạng thái xử lý…";
		if (query.isError && !set) return "Không tải được trạng thái xử lý.";
		if (!eligible) return blockedReason ?? "Phiên bản này chưa đủ điều kiện xử lý.";
		if (status === "READY" && !set?.active) return "Bộ đoạn trích chưa được đưa vào sử dụng.";
		return status ? labels[status] : "Chưa khởi tạo xử lý";
	};
	const issue = set?.quality_report?.issues.find((code) => Object.hasOwn(extractionIssues, code));
	const failureMessage =
		set?.error_code === "ingestion_not_configured"
			? "Dịch vụ xử lý tài liệu chưa được cấu hình."
			: "Không thể xử lý tài liệu. Hãy thử lại sau khi kiểm tra dịch vụ và tệp gốc.";
	return (
		<section className="space-y-1 border-b border-[#dfe8df] pb-3" aria-label="Xử lý tri thức">
			<p className="text-xs font-medium text-muted-foreground">Xử lý tri thức</p>
			<output className="block text-sm font-semibold">
				{title()}
				{eligible && status === "READY" && set?.active ? ` · ${set.chunk_count} đoạn trích` : null}
			</output>
			{eligible && status === "NEEDS_REVIEW" && (
				<p className="text-sm text-muted-foreground">
					{issue
						? extractionIssues[issue]
						: "Nội dung PDF chưa thể trích xuất đầy đủ. Hãy tạo một phiên bản mới từ bản PDF đã sửa."}
				</p>
			)}
			{eligible && status === "FAILED" && (
				<>
					<p className="text-sm text-muted-foreground">{failureMessage}</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={busy || retry.isPending}
						onClick={() => retry.mutate()}
					>
						Thử lại xử lý
					</Button>
					{retry.isError && <p role="alert">Không thể gửi yêu cầu thử lại.</p>}
				</>
			)}
		</section>
	);
}
