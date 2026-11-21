import { Button } from "../../shared/components";
import {
	confidenceLabels,
	formatInvestigationDate,
	issueLabels,
	technicalLabels,
} from "./ai-investigations.display";
import type {
	InvestigationDetail,
	InvestigationIssue,
	InvestigationSource,
} from "./ai-investigations.types";

const sectionTitle = "text-base font-bold text-[#10221b]";
const muted = "text-sm text-[#54655a]";
const readableText = "whitespace-pre-wrap break-words text-sm text-[#10221b]";

function EvidenceLinks({
	ids,
	label,
	sources,
}: { ids: number[]; label: string; sources: InvestigationSource[] }) {
	if (!ids.length) return null;
	return (
		<p className={muted}>
			<span className="font-semibold">{label}</span>{" "}
			{ids.map((id, index) => {
				const recorded = sources.some((source) => source.evidenceId === id);
				return (
					<span key={id}>
						{index > 0 && ", "}
						{recorded ? (
							<a
								href={`#ai-investigation-source-${id}`}
								className="font-medium text-[#164027] underline"
							>
								Nguồn {id}
							</a>
						) : (
							<span>Nguồn {id} không còn truy cập được</span>
						)}
					</span>
				);
			})}
		</p>
	);
}

function IssueDetails({
	issue,
	sources,
}: { issue: InvestigationIssue; sources: InvestigationSource[] }) {
	return (
		<li className="space-y-2 rounded-xl border border-[#dfe8df] p-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h4 className="text-sm font-bold text-[#10221b]">{issueLabels[issue.classification]}</h4>
				<span className={muted}>Độ tin cậy {confidenceLabels[issue.confidence].toLowerCase()}</span>
			</div>
			<p className={readableText}>
				<strong className="font-semibold">Quan sát</strong>
				{" · "}
				{issue.observation}
			</p>
			{issue.suspectedCause && (
				<p className={readableText}>
					<strong className="font-semibold">Giả thuyết</strong>
					{" · "}
					{issue.suspectedCause}
				</p>
			)}
			<EvidenceLinks ids={issue.supportingEvidence} label="Bằng chứng hỗ trợ" sources={sources} />
			<EvidenceLinks
				ids={issue.conflictingEvidence}
				label="Bằng chứng mâu thuẫn"
				sources={sources}
			/>
			{issue.uncertainty && (
				<p className={readableText}>
					<strong className="font-semibold">Điểm chưa chắc chắn</strong>
					{" · "}
					{issue.uncertainty}
				</p>
			)}
			{issue.missingInformation.length > 0 && (
				<p className={readableText}>
					<strong className="font-semibold">Thông tin còn thiếu</strong>
					{" · "}
					{issue.missingInformation.join("; ")}
				</p>
			)}
			{issue.proposedRemediation && (
				<p className={readableText}>
					<strong className="font-semibold">Hướng xử lý đề xuất</strong>
					{" · "}
					{issue.proposedRemediation}
				</p>
			)}
			{issue.regressionCases.length > 0 && (
				<details className="text-sm text-[#10221b]">
					<summary className="cursor-pointer font-semibold text-[#164027]">
						Kịch bản kiểm thử đề xuất
					</summary>
					<ul className="mt-2 space-y-2">
						{issue.regressionCases.map((test) => (
							<li key={`${test.scenario}:${test.expected}`} className={readableText}>
								<p>{test.scenario}</p>
								<p className={muted}>Kết quả mong đợi · {test.expected}</p>
							</li>
						))}
					</ul>
				</details>
			)}
		</li>
	);
}

export function InvestigationReport({
	detail,
	onGroupOpen,
}: { detail: InvestigationDetail; onGroupOpen: (id: string) => void }) {
	const issues = detail.reportRestricted ? [] : (detail.report?.issues ?? []);
	const unavailableReason = detail.reportRestricted
		? "Không thể hiển thị báo cáo vì nguồn dùng để phân tích không còn quyền truy cập."
		: detail.evidenceRemovedAt
			? "Báo cáo đã được dọn cùng bằng chứng theo chính sách lưu giữ."
			: detail.processingStatus === "FAILED"
				? "Phân tích tự động thất bại. Bạn vẫn có thể xem xét dựa trên bằng chứng còn lại."
				: "Chưa có báo cáo phân tích.";
	return (
		<section className="space-y-3">
			<h3 className={sectionTitle}>Kết quả phân tích AI</h3>
			{issues.length > 0 ? (
				<>
					<p className={muted}>Các phát hiện dưới đây cần được xác minh trước khi ghi kết luận.</p>
					<ul className="space-y-2">
						{issues.map((issue, index) => (
							<IssueDetails
								key={`${issue.classification}:${index}`}
								issue={issue}
								sources={detail.sources}
							/>
						))}
					</ul>
				</>
			) : (
				<p className={muted}>{unavailableReason}</p>
			)}
			{detail.observations.unmatchedCitation && (
				<p className={readableText}>
					<strong className="font-semibold">Đối chiếu dấu vết</strong>
					{" · "}Có trích dẫn nằm ngoài tập nguồn đã truy xuất.
				</p>
			)}
			{!detail.reportRestricted && detail.groups.length > 0 && (
				<div>
					<h4 className="mb-2 text-sm font-semibold text-[#10221b]">Nhóm vấn đề</h4>
					<div className="flex flex-wrap gap-2">
						{detail.groups.map((group) => (
							<Button
								key={`${group.id}:${group.issueIndex}`}
								variant="secondary"
								size="sm"
								onClick={() => onGroupOpen(group.id)}
							>
								{issueLabels[group.classification]} · {group.caseCount} hồ sơ
							</Button>
						))}
					</div>
				</div>
			)}
		</section>
	);
}

export function InvestigationFeedback({ detail }: { detail: InvestigationDetail }) {
	const { evidence, evidenceRemovedAt, reason } = detail;
	return (
		<section className="space-y-3">
			<h3 className={sectionTitle}>Nội dung phản hồi</h3>
			<dl className="space-y-3 rounded-xl bg-[#f4f7f2] p-3">
				{evidence ? (
					<>
						<div>
							<dt className="text-sm font-semibold">Câu hỏi</dt>
							<dd className={readableText}>
								{evidence.question || "Không có câu hỏi trong bản ghi."}
							</dd>
						</div>
						<div>
							<dt className="text-sm font-semibold">Câu trả lời</dt>
							<dd className={readableText}>
								{evidence.answer || "Không có câu trả lời trong bản ghi."}
							</dd>
						</div>
						<div>
							<dt className="text-sm font-semibold">Ghi nhận bằng chứng</dt>
							<dd className={muted}>
								{evidence.provenance === "CLIENT_REPORTED"
									? "Do thiết bị gửi kèm phản hồi"
									: "Do hệ thống ghi nhận"}
							</dd>
						</div>
					</>
				) : (
					<div>
						<dt className="sr-only">Tình trạng bằng chứng</dt>
						<dd className={muted}>
							{evidenceRemovedAt
								? `Bằng chứng đã được dọn theo chính sách lưu giữ vào ${formatInvestigationDate(evidenceRemovedAt)}.`
								: "Hồ sơ chưa có dữ liệu bằng chứng."}
						</dd>
					</div>
				)}
				{reason && (
					<div>
						<dt className="text-sm font-semibold">Lý do phản hồi</dt>
						<dd className={readableText}>{reason}</dd>
					</div>
				)}
			</dl>
		</section>
	);
}

export function InvestigationEvidence({ detail }: { detail: InvestigationDetail }) {
	const { evidence, sources } = detail;
	const traceAt = evidence?.trace?.inferenceStartedAt ?? evidence?.trace?.observedAt;
	const technicalFields = [
		["Mô hình trả lời", evidence?.modelId],
		["Phiên bản mô hình", evidence?.modelVersion],
		["Phiên bản gói dữ liệu", evidence?.packageVersion],
		["Phiên bản chỉ dẫn mô hình", evidence?.promptVersion],
		["Phiên bản cấu hình truy xuất", evidence?.retrievalConfigVersion],
		["Phiên bản chính sách an toàn", evidence?.trace?.safetyPolicyVersion],
		["Phiên bản cấu hình suy luận", evidence?.trace?.runtimeConfigVersion],
		["Thời điểm suy luận", traceAt && formatInvestigationDate(traceAt)],
		["Mô hình phân tích", detail.reportRestricted ? null : detail.report?.model],
	].filter(([, value]) => value != null && value !== "");
	return (
		<section className="space-y-3">
			<h3 className={sectionTitle}>Nguồn và bằng chứng</h3>
			{!evidence && sources.length === 0 && (
				<p className={muted}>Không có nguồn hoặc dấu vết suy luận để hiển thị.</p>
			)}
			{evidence && detail.mode === "ONLINE" && sources.length === 0 && (
				<p className={muted}>Không có thông tin nguồn trong hồ sơ.</p>
			)}
			{sources.length > 0 && (
				<ul className="divide-y divide-[#e0ebe0]">
					{sources.map(({ evidenceId, cited, status, reference }) => (
						<li
							key={evidenceId}
							id={`ai-investigation-source-${evidenceId}`}
							className="scroll-mt-16 space-y-1 py-2"
						>
							<p className={readableText}>
								Nguồn {evidenceId} ·{" "}
								{status === "AVAILABLE" && reference ? reference.title : "Không còn truy cập được"}
							</p>
							<p className={muted}>
								{cited ? "Đã trích dẫn" : "Đã truy xuất"}
								{status === "AVAILABLE" &&
									reference &&
									` · Phiên bản ${reference.version} · Trang ${[...new Set(reference.locations.map(({ page }) => page))].join(", ")}`}
							</p>
						</li>
					))}
				</ul>
			)}
			{evidence && (
				<details className="text-sm">
					<summary className="cursor-pointer font-semibold text-[#164027]">
						Dấu vết suy luận
					</summary>
					{!evidence.trace && (
						<p className={`mt-2 ${muted}`}>Không có dấu vết suy luận trong bản ghi.</p>
					)}
					<dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
						{technicalFields.map(([label, value]) => (
							<div key={label}>
								<dt className={muted}>{label}</dt>
								<dd className={readableText}>{value}</dd>
							</div>
						))}
					</dl>
				</details>
			)}
		</section>
	);
}

const historyLabels: Record<string, string> = {
	AI_INVESTIGATION_START_REVIEW: "Bắt đầu xem xét",
	AI_INVESTIGATION_HANDOFF: "Bàn giao kỹ thuật",
	AI_INVESTIGATION_RESOLVE: "Xác nhận kết quả xử lý",
};

export function InvestigationHistory({ detail }: { detail: InvestigationDetail }) {
	return (
		<section className="space-y-3">
			<h3 className={sectionTitle}>Lịch sử xử lý</h3>
			{detail.history.length === 0 && <p className={muted}>Chưa ghi nhận thao tác xử lý.</p>}
			<ol className="space-y-3 border-l border-[#dfe8df] pl-4">
				{[...detail.history].reverse().map((entry) => (
					<li
						key={entry.version}
						className="relative space-y-1 before:absolute before:top-1.5 before:-left-[1.28rem] before:size-2 before:rounded-full before:bg-[#2d5a27]"
					>
						<h4 className="text-sm font-semibold text-[#10221b]">
							{historyLabels[entry.action] ?? "Cập nhật hồ sơ"}
						</h4>
						<p className={muted}>
							{entry.actorName || "Không rõ người thực hiện"} ·{" "}
							<time dateTime={entry.at}>{formatInvestigationDate(entry.at)}</time>
						</p>
						{entry.action === "AI_INVESTIGATION_RESOLVE" && (
							<p className={readableText}>{technicalLabels[entry.technicalStatus][0]}</p>
						)}
						{entry.reference && <p className={readableText}>Tham chiếu · {entry.reference}</p>}
						{entry.verification && <p className={readableText}>{entry.verification}</p>}
						{entry.resolutionNote && <p className={readableText}>{entry.resolutionNote}</p>}
					</li>
				))}
			</ol>
		</section>
	);
}
