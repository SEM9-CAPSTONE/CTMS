import { useSourceChunking } from "../hooks/useSourceChunking";
import type { ChunkSetStatus } from "../types";

const labels: Record<ChunkSetStatus, string> = {
	PENDING: "Đang chờ xử lý tự động",
	RUNNING: "Đang tạo dữ liệu tri thức",
	READY: "Dữ liệu tri thức đã sẵn sàng",
	FAILED: "Không thể hoàn tất xử lý",
	NEEDS_REVIEW: "Chưa thể trích xuất đầy đủ nội dung",
	OBSOLETE: "Phiên bản không còn hiệu lực",
};

const criticalText = "Một số cảnh báo hoặc hướng dẫn an toàn bị thiếu sau khi trích xuất.";
const procedure = "Quá trình trích xuất chưa giữ được đầy đủ các bước và điều kiện của hướng dẫn.";
const extractionIssues: Record<string, string> = {
	missing_critical_pdf_text: criticalText,
	missing_critical_content: criticalText,
	procedure_split_requires_review: procedure,
	procedure_context_split_requires_review: procedure,
	pdf_text_coverage_incomplete: "Nội dung trích xuất còn thiếu so với văn bản trong PDF.",
	pdf_page_count_mismatch: "Số trang trích xuất chưa khớp với PDF gốc.",
	page_text_unverifiable: "Có trang chưa xác minh được nội dung văn bản.",
	table_header_unverified: "Chưa xác minh được tiêu đề cột và nội dung bảng.",
	visual_content_requires_review: "Chưa xác minh được nội dung trong hình minh họa hoặc công thức.",
	missing_source_location: "Một số đoạn trích chưa xác định được vị trí trên PDF gốc.",
	invalid_source_page: "Một số đoạn trích chưa đối chiếu được với trang tương ứng trong PDF gốc.",
	missing_extracted_content: "Một số đoạn văn bản bị thiếu sau khi trích xuất.",
	pdf_conversion_incomplete: "Quá trình đọc PDF chưa hoàn tất.",
	low_extraction_confidence: "Nội dung hoặc bố cục trích xuất chưa đủ tin cậy.",
	pdf_text_read_failed: "Hệ thống chưa đọc được văn bản trong PDF.",
	pdf_encrypted: "PDF có mã hóa. Có thể tạo phiên bản mới từ bản PDF không mã hóa.",
	pdf_no_pages: "PDF không có trang nào để trích xuất.",
	pdf_page_limit_exceeded: "PDF có số trang vượt giới hạn mà hệ thống có thể xử lý.",
	empty_or_excessive_chunks: "Hệ thống chưa tạo được số lượng đoạn trích phù hợp.",
	token_budget_or_empty_chunk: "Một số đoạn trích trống hoặc dài hơn giới hạn xử lý.",
	context_exceeds_token_budget: "Thông tin đi kèm mỗi đoạn trích vượt giới hạn xử lý.",
};

function technicalFailure(code: string) {
	if (code === "ingestion_not_configured" || code === "ingestion_http_401")
		return "Hệ thống chưa kết nối được với dịch vụ xử lý tài liệu.";
	if (code === "lease_expired") return "Lần xử lý trước đã bị gián đoạn.";
	if (code === "source_file_unavailable") return "Hệ thống chưa đọc được tệp PDF đã lưu.";
	if (code === "ingestion_http_429") return "Dịch vụ xử lý tài liệu đang bận.";
	if (code === "ingestion_transport" || /^ingestion_http_5\d\d$/.test(code))
		return "Dịch vụ xử lý tài liệu tạm thời gặp lỗi.";
	return "Hệ thống gặp lỗi khi tạo dữ liệu tri thức cho phiên bản này.";
}

export function SourceChunkingStatus({
	documentId,
	versionId,
	current,
	eligible,
	blockedReason,
}: {
	documentId: string;
	versionId: string;
	current: boolean;
	eligible: boolean;
	blockedReason?: string | null;
}) {
	const query = useSourceChunking(documentId, versionId, eligible);
	const set = query.data?.[0];
	const status = set?.status;
	const recovering = set?.status === "FAILED" && set.automatic_recovery_pending;
	const title = () => {
		if (!current) return labels.OBSOLETE;
		if (!eligible) return "Phiên bản này chưa đủ điều kiện xử lý";
		if (query.isPending) return "Đang tải trạng thái xử lý";
		if (query.isError && !set) return "Không tải được trạng thái xử lý";
		if (recovering) return "Tạm thời chưa thể xử lý";
		if (set?.status === "READY")
			return set.active
				? `${labels.READY} · ${set.chunk_count} đoạn trích`
				: "Bộ đoạn trích chưa được đưa vào sử dụng";
		return labels[status ?? "PENDING"];
	};

	let explanation: string | null = null;
	if (current && !eligible) explanation = blockedReason ?? null;
	if (eligible && set?.status === "NEEDS_REVIEW") {
		const issues = set.quality_report?.issues ?? [];
		explanation =
			issues
				.map((code) => (Object.hasOwn(extractionIssues, code) ? extractionIssues[code] : null))
				.find(Boolean) ??
			"Hệ thống chưa xác minh được nội dung trích xuất. Phiên bản này chưa được dùng để trả lời.";
	}
	if (eligible && (status === "FAILED" || (status === "PENDING" && set?.error_code))) {
		explanation = technicalFailure(set?.error_code ?? "");
		if (recovering || status === "PENDING") explanation += " Hệ thống sẽ tự động thử lại.";
	}

	return (
		<section className="space-y-1 border-b border-[#dfe8df] pb-3" aria-label="Xử lý tri thức">
			<p className="text-xs font-medium text-muted-foreground">Xử lý tri thức</p>
			<output className="block text-sm font-semibold">{title()}</output>
			{explanation && <p className="text-sm text-muted-foreground">{explanation}</p>}
		</section>
	);
}
