import { createHash, randomUUID } from "node:crypto";
import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
// biome-ignore lint/style/useImportType: Nest injection
import { RagRepository } from "../rag/rag.repository";
import { isEligiblePublishedSource } from "../survival-documents/source-policy";
import { type SourceVersion, VERSION_SELECT } from "../survival-documents/survival-documents.types";
import type { VerifyContentDto } from "./content-verification.dto";
import {
	type ChunkSet,
	type ExtractionSnapshot,
	type IntegrityDecision,
	type IntegrityRegion,
	chunkConfiguration,
} from "./knowledge-chunks.types";

function invalid(message: string): never {
	throw new UnprocessableEntityException({ code: "CONTENT_VERIFICATION_INVALID", message });
}
function conflict(): never {
	throw new ConflictException({
		code: "CONTENT_VERIFICATION_CHANGED",
		message: "Nội dung đã thay đổi. Vui lòng tải lại trước khi xác nhận.",
	});
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const resolved = (region: IntegrityRegion) => !!region.decision || region.assessment === "verified";

export function assertVerificationDecision(
	region: IntegrityRegion,
	decision: IntegrityDecision,
	snapshot: ExtractionSnapshot
): void {
	const emptyConfirmation =
		region.kind === "table" &&
		region.empty_form === true &&
		decision.action === "confirm" &&
		decision.visual_checked &&
		(decision.reason?.trim().length ?? 0) >= 10 &&
		!region.original_text.trim();
	if (
		decision.block_texts &&
		(Object.keys(decision.block_texts).length > 100 ||
			Object.entries(decision.block_texts).some(
				([ref, text]) =>
					!region.item_refs.includes(ref) || typeof text !== "string" || text.length > 30000
			) ||
			JSON.stringify(decision.block_texts).length > 60000)
	)
		invalid("Nội dung chỉnh sửa phải thuộc đúng vùng đang kiểm tra.");
	if (!decision.source_checked || !decision.context_checked)
		invalid("Cần đối chiếu PDF gốc và nội dung liên quan.");
	if ((region.related_figures.length || region.kind === "image") && !decision.visual_checked)
		invalid("Cần kiểm tra hình ảnh và nội dung hướng dẫn liên quan.");
	if (decision.action === "exclude") {
		if (!region.excludable || region.critical || (decision.reason?.trim().length ?? 0) < 10)
			invalid(
				"Không thể bỏ qua nội dung này. Cần xác minh đầy đủ nội dung hoặc cung cấp lý do phù hợp."
			);
		if (
			region.related_figures.some(
				(ref) =>
					!snapshot.regions.some(
						(r) =>
							r.kind === "image" && r.item_refs.includes(ref) && r.decision?.action === "describe"
					)
			)
		)
			invalid("Cần xác minh nội dung hình liên quan trước khi bỏ qua nhãn hình.");
	} else if (!decision.text.trim() && !emptyConfirmation)
		invalid("Vui lòng nhập nội dung đã đối chiếu với PDF gốc.");
	if (decision.action === "confirm" && decision.text.trim() !== region.original_text.trim())
		invalid("Văn bản đã thay đổi. Hãy lưu nội dung đã sửa sau khi đối chiếu.");
	if (
		region.kind === "image" &&
		(decision.action !== "describe" || decision.text.trim().length < 10)
	)
		invalid("Vui lòng mô tả đầy đủ nội dung hình đã kiểm tra.");
	if (region.kind === "table" && decision.action !== "correct" && !emptyConfirmation)
		invalid("Cần đối chiếu và lưu đầy đủ hàng, cột của bảng.");
	if (region.kind === "table" && !emptyConfirmation) {
		const rows = decision.text
			.split("\n")
			.filter((line) => line.trim())
			.map((line) =>
				line
					.trim()
					.replace(/^\||\|$/g, "")
					.split("|")
					.map((cell) => cell.trim())
			);
		if (
			rows.length < 3 ||
			!rows[1].every((cell) => /^:?-{3,}:?$/.test(cell)) ||
			rows.some((row) => row.length !== rows[0].length)
		)
			invalid("Cần giữ đầy đủ tiêu đề, hàng và cột của bảng đã đối chiếu.");
	}
	if (decision.action === "correct" && region.kind !== "table" && region.item_refs.length > 1) {
		const document = snapshot.document as { texts?: Array<{ self_ref: string }> };
		const targets = (document.texts ?? []).filter((item) =>
			region.item_refs.includes(item.self_ref)
		);
		const separate = region.item_refs.filter(
			(ref) => !targets.some((item) => item.self_ref === ref)
		);
		if (
			!targets.length ||
			separate.some(
				(ref) =>
					!snapshot.regions.some(
						(item) =>
							item.id !== region.id &&
							["image", "table", "formula"].includes(item.kind) &&
							item.item_refs.includes(ref)
					)
			) ||
			!decision.block_texts ||
			targets.some((item) => !(item.self_ref in (decision.block_texts ?? {})))
		)
			invalid("Cần giữ riêng từng đoạn và kiểm tra bảng, hình tại vị trí tương ứng.");
	}
	if (
		!["image", "table"].includes(region.kind) &&
		!region.item_refs.some((ref) => ref.startsWith("#/texts/")) &&
		!decision.after_item_ref
	)
		invalid("Cần chọn vị trí đặt nội dung bị thiếu trong trang gốc.");
}

function publicPosition(region: IntegrityRegion, snapshot: ExtractionSnapshot) {
	const document = snapshot.document as {
		pages?: Record<string, { size: { width: number; height: number } }>;
		texts?: Array<{ self_ref: string; text: string; prov?: Array<{ page_no: number }> }>;
		tables?: Array<{ self_ref: string; data: unknown; prov?: Array<{ page_no: number }> }>;
		pictures?: Array<{ self_ref: string; prov?: Array<{ page_no: number }> }>;
	};
	const labels: Record<string, string> = {
		image: "Hình ảnh",
		caption: "Chú thích hình",
		table: "Bảng",
		formula: "Công thức",
		page: "Nội dung trang",
		text: "Đoạn văn",
	};
	return {
		id: region.id,
		page: region.page,
		bbox: region.bbox,
		label: labels[region.kind] ?? "Nội dung cần đối chiếu",
		kind: region.kind,
		emptyForm: region.empty_form === true,
		instruction:
			region.kind === "table"
				? "Đối chiếu tiêu đề, từng hàng, cột và các ô trống của bảng với bản gốc."
				: region.kind === "image"
					? "Mô tả đầy đủ thông tin và các hướng dẫn thể hiện trong hình."
					: region.issues.some((code) => code.includes("numeric"))
						? "Đối chiếu lại các con số và đơn vị với PDF gốc."
						: region.kind === "caption"
							? "Kiểm tra chú thích gắn đúng hình và giữ đầy đủ thông tin hướng dẫn liên quan."
							: "Đối chiếu nội dung, điều kiện, cảnh báo và thứ tự hướng dẫn ở vùng này với bản gốc.",
		originalText: region.original_text,
		alternativeText: region.recovery_text || null,
		text: region.decision?.text ?? region.original_text,
		resolved: resolved(region),
		canExclude: region.excludable && !region.critical,
		needsVisualCheck:
			region.related_figures.length > 0 || region.kind === "image" || region.empty_form === true,
		needsAnchor:
			!["image", "table"].includes(region.kind) &&
			!region.item_refs.some((ref) => ref.startsWith("#/texts/")),
		afterItemRef: region.decision?.after_item_ref ?? null,
		blocks: (document.texts ?? [])
			.filter((item) => region.item_refs.includes(item.self_ref))
			.map((item) => ({
				ref: item.self_ref,
				text: region.decision?.block_texts?.[item.self_ref] ?? item.text,
			})),
		anchors: [
			...(document.texts ?? [])
				.filter((item) => item.text.trim() && item.prov?.some((p) => p.page_no === region.page))
				.map((item) => ({ ref: item.self_ref, text: item.text.slice(0, 180) })),
			...(document.pictures ?? [])
				.filter((item) => item.prov?.some((p) => p.page_no === region.page))
				.map((item, index) => ({ ref: item.self_ref, text: `Hình ảnh ${index + 1} trong trang` })),
			...(document.tables ?? [])
				.filter((item) => item.prov?.some((p) => p.page_no === region.page))
				.map((item, index) => ({ ref: item.self_ref, text: `Bảng ${index + 1} trong trang` })),
		],
		table: document.tables?.find((item) => region.item_refs.includes(item.self_ref))?.data,
	};
}

@Injectable()
export class ContentVerificationService {
	constructor(
		private readonly db: DataSource,
		private readonly rag: RagRepository
	) {}
	async inspect(documentId: string, versionId: string) {
		const [version]: SourceVersion[] = await this.db.query(
			`${VERSION_SELECT} WHERE document_id=$1 AND id=$2`,
			[documentId, versionId]
		);
		if (!version) throw new NotFoundException({ message: "Không tìm thấy phiên bản tài liệu." });
		const [set]: ChunkSet[] = await this.db.query(
			"SELECT * FROM knowledge_chunk_sets WHERE document_id=$1 AND document_version_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1",
			[documentId, versionId]
		);
		const snapshot = set?.extraction_snapshot;
		const issues = set?.quality_report?.issues ?? [];
		const notice = issues.some((code) =>
			["pdf_conversion_incomplete", "pdf_page_count_mismatch"].includes(code)
		)
			? "Chưa đọc được đầy đủ các trang. Hãy tạo phiên bản từ bản PDF rõ hơn hoặc có thể chọn và sao chép chữ."
			: issues.some((code) => ["invalid_source_bbox", "missing_source_location"].includes(code))
				? "Chưa xác định chính xác được vị trí một số nội dung. Hãy dùng bản PDF có thể chọn và sao chép chữ để đối chiếu đầy đủ."
				: null;
		return {
			notice,
			inUse: await this.rag.hasEligibleDocument(documentId, versionId),
			extractionId: set?.id ?? null,
			revision: snapshot?.revision ?? 0,
			preparing: !set || ["PENDING", "RUNNING"].includes(set.status),
			available: !!snapshot,
			complete: set?.status === "READY",
			positions: snapshot?.regions.map((region) => publicPosition(region, snapshot)) ?? [],
		};
	}
	async verify(
		actor: string,
		documentId: string,
		versionId: string,
		regionId: string,
		dto: VerifyContentDto
	) {
		if (!/^[a-f0-9]{64}$/.test(regionId)) invalid("Vị trí cần kiểm tra không hợp lệ.");
		const payloadHash = hash({ versionId, regionId, ...dto });
		await this.db.transaction(async (manager) => {
			const [document]: Array<{ current_published_version_id: string | null }> =
				await manager.query(
					"SELECT current_published_version_id FROM survival_documents WHERE id=$1 FOR UPDATE",
					[documentId]
				);
			if (!document) throw new NotFoundException({ message: "Không tìm thấy tài liệu." });
			const [version]: SourceVersion[] = await manager.query(
				`${VERSION_SELECT} WHERE document_id=$1 AND id=$2`,
				[documentId, versionId]
			);
			if (!isEligiblePublishedSource(version, document.current_published_version_id)) conflict();
			const [receipt]: Array<{ after: { payloadHash: string } }> = await manager.query(
				`SELECT "after" FROM audit_logs WHERE target_type='survival_document' AND target_id=$1 AND actor_id=$2
				 AND action='survival_document.content_verify' AND "after"->>'requestId'=$3 LIMIT 1`,
				[documentId, actor, dto.requestId]
			);
			if (receipt) {
				if (receipt.after.payloadHash !== payloadHash) conflict();
				return;
			}
			const [set]: ChunkSet[] = await manager.query(
				"SELECT * FROM knowledge_chunk_sets WHERE document_id=$1 AND document_version_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",
				[documentId, versionId]
			);
			if (
				!set ||
				set.id !== dto.extractionId ||
				!set.extraction_snapshot ||
				!["NEEDS_REVIEW", "READY"].includes(set.status)
			)
				conflict();
			const snapshot = structuredClone(set.extraction_snapshot);
			if (
				snapshot.revision !== dto.expectedRevision ||
				snapshot.checksum !== version.checksum ||
				snapshot.document_version_id !== versionId
			)
				conflict();
			const region = snapshot.regions.find((item) => item.id === regionId);
			if (!region) invalid("Không tìm thấy vị trí cần kiểm tra.");
			const decision: IntegrityDecision = {
				action: dto.action,
				text: dto.text.trim(),
				source_checked: dto.source_checked,
				context_checked: dto.context_checked,
				visual_checked: dto.visual_checked,
				...(dto.reason ? { reason: dto.reason.trim() } : {}),
				...(dto.after_item_ref ? { after_item_ref: dto.after_item_ref } : {}),
				...(dto.block_texts ? { block_texts: dto.block_texts } : {}),
			};
			assertVerificationDecision(region, decision, snapshot);
			if (decision.after_item_ref) {
				const inserted = (snapshot.decision_refs as Record<string, string> | undefined)?.[
					region.id
				];
				if (inserted === decision.after_item_ref)
					invalid("Không thể đặt nội dung ngay sau chính nó.");
				const anchors = publicPosition(region, snapshot).anchors;
				if (!anchors.some((anchor) => anchor.ref === decision.after_item_ref))
					invalid("Vị trí đặt nội dung phải thuộc đúng trang đang kiểm tra.");
			}
			const before = {
				versionId,
				checksum: version.checksum,
				page: region.page,
				bbox: region.bbox,
				originalText: region.original_text,
				previousText: region.decision?.text ?? region.original_text,
				itemRefs: region.item_refs,
				regionId,
			};
			region.decision = decision;
			snapshot.revision++;
			let target = set.id;
			if (set.status === "READY") {
				// A review revision is a new derived candidate; the active set stays immutable.
				const configuration = {
					...chunkConfiguration(),
					...set.configuration,
					verification_revision: (set.configuration.verification_revision ?? 0) + 1,
				};
				snapshot.configuration = configuration;
				target = randomUUID();
				await manager.query(
					`INSERT INTO knowledge_chunk_sets(id,document_id,document_version_id,source_version,checksum,locale,configuration,config_hash)
				 VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
					[
						target,
						documentId,
						versionId,
						set.source_version,
						set.checksum,
						set.locale,
						JSON.stringify(configuration),
						hash(configuration),
					]
				);
			}
			const complete = snapshot.regions.every(resolved);
			const report = {
				...set.quality_report,
				status: "NEEDS_REVIEW",
				integrity: { revision: snapshot.revision, complete: false, regions: snapshot.regions },
			};
			await manager.query(
				`UPDATE knowledge_chunk_sets SET extraction_snapshot=$2::jsonb,quality_report=$3::jsonb,
			 status=$4::varchar,attempts=0,recovery_round=0,error_code=CASE WHEN $4::varchar='PENDING' THEN NULL ELSE 'extraction_needs_review' END,
			 retryable_failure=false,next_attempt_at=clock_timestamp(),completed_at=NULL WHERE id=$1`,
				[
					target,
					JSON.stringify(snapshot),
					JSON.stringify(report),
					complete ? "PENDING" : "NEEDS_REVIEW",
				]
			);
			await manager.query(
				`INSERT INTO audit_logs(actor_id,action,target_type,target_id,"before","after",reason)
			 VALUES($1,'survival_document.content_verify','survival_document',$2,$3::jsonb,$4::jsonb,$5)`,
				[
					actor,
					documentId,
					JSON.stringify(before),
					JSON.stringify({
						...before,
						extractionId: target,
						verifiedText: decision.text,
						blockTexts: decision.block_texts,
						afterItemRef: decision.after_item_ref,
						action: decision.action,
						sourceChecked: true,
						contextChecked: true,
						visualChecked: decision.visual_checked,
						reason: decision.reason,
						requestId: dto.requestId,
						payloadHash,
						revision: snapshot.revision,
					}),
					decision.reason?.slice(0, 255) ?? null,
				]
			);
		});
		return this.inspect(documentId, versionId);
	}
}
