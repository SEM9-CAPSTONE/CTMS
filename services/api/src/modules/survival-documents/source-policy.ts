import { isIP } from "node:net";
import { invalidSource, validateMetadata } from "./dto/source.dto";
import {
	Classification,
	DocumentStatus,
	MedicalStatus,
	RightsStatus,
	type SourceMetadata,
	type SourceRights,
	type SourceUse,
	type SourceVersion,
} from "./survival-documents.types";

const SOURCE_NOT_APPROVED =
	"Nguồn PDF chưa được xác nhận. Cần dùng nguồn chính thức hoặc bản PDF đã được xác minh.";

type SourceIdentity = Pick<SourceVersion, "metadata" | "checksum"> &
	Partial<
		Pick<SourceVersion, "rights" | "reviewedBy" | "reviewedAt" | "publishedBy" | "publishedAt">
	>;

export function isConfiguredKnowledgeSource(
	source: Pick<SourceVersion, "metadata" | "checksum">
): boolean {
	const checksums = (process.env.SURVIVAL_KNOWLEDGE_APPROVED_SHA256 ?? "")
		.trim()
		.toLowerCase()
		.split(/\s*,\s*/);
	if (/^[a-f0-9]{64}$/.test(source.checksum) && checksums.includes(source.checksum)) return true;
	const sourceUrl = source.metadata.sourceUrl;
	if (sourceUrl) {
		const url = new URL(sourceUrl);
		const host = url.hostname.toLowerCase().replace(/\.$/, "");
		const hosts = (process.env.SURVIVAL_KNOWLEDGE_APPROVED_HOSTS ?? "")
			.trim()
			.toLowerCase()
			.split(/\s*,\s*/);
		if (
			url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			!url.port &&
			hosts.includes(host)
		)
			return true;
	}
	return false;
}

export function assertApprovedSource(source: SourceIdentity): void {
	if (isConfiguredKnowledgeSource(source)) return;
	if (
		source.publishedBy &&
		source.publishedAt &&
		source.rights?.rightsReviewStatus === RightsStatus.NOT_REVIEWED &&
		source.rights.sourceReviewConfirmed === true
	)
		return;
	if (source.reviewedBy && source.reviewedAt && source.rights) {
		validatePublicationMetadata(source.metadata);
		assertRights(source.metadata, source.rights);
		return;
	}
	throw invalidSource(SOURCE_NOT_APPROVED);
}

export function validateSourceMetadata(metadata: SourceMetadata): void {
	if (!metadata) throw invalidSource("Thiếu thông tin nguồn.");
	for (const value of [metadata.sourceUrl, metadata.licenseUrl]) {
		if (!value) continue;
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			throw invalidSource("Đường dẫn nguồn phải là HTTPS hợp lệ.");
		}
		const host = url.hostname.toLowerCase().replace(/\.$/, "");
		if (
			url.protocol !== "https:" ||
			url.username ||
			url.password ||
			(url.port && url.port !== "443") ||
			isIP(host) ||
			host.includes(":") ||
			!host.includes(".") ||
			/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)
		)
			throw invalidSource("Chỉ chấp nhận đường dẫn HTTPS công khai, không chứa tài khoản.");
	}
	const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
	const nowWithTolerance = Date.now() + 60_000;
	const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(
		new Date()
	);
	let retrievedEnd = nowWithTolerance;
	if (metadata.retrievedAt) {
		const dateOnly = isDateOnly(metadata.retrievedAt);
		retrievedEnd = Date.parse(
			dateOnly ? `${metadata.retrievedAt}T23:59:59.999+07:00` : metadata.retrievedAt
		);
		if (
			!Number.isFinite(retrievedEnd) ||
			(dateOnly ? metadata.retrievedAt > today : retrievedEnd > nowWithTolerance)
		)
			throw invalidSource("Ngày xuất bản và ngày truy cập không hợp lệ.");
	}
	const { sourcePublishedAt } = metadata;
	if (!sourcePublishedAt) return;
	const dateOnly = isDateOnly(sourcePublishedAt);
	const publication = Date.parse(
		dateOnly ? `${sourcePublishedAt}T00:00:00+07:00` : sourcePublishedAt
	);
	if (
		!Number.isFinite(publication) ||
		publication > retrievedEnd ||
		(dateOnly ? sourcePublishedAt > today : publication > nowWithTolerance)
	)
		throw invalidSource("Ngày xuất bản và ngày truy cập không hợp lệ.");
}

function isTranslation(metadata: SourceMetadata): boolean {
	return !!metadata.originalLocale && metadata.locale !== metadata.originalLocale;
}

export function validatePublishedSourceMetadata(metadata: SourceMetadata): void {
	validateMetadata(metadata);
	validateSourceMetadata(metadata);
	if (isTranslation(metadata) && (!metadata.originalVersionId || !metadata.adaptationDisclaimer))
		throw invalidSource("Bản dịch cần phiên bản gốc và thông báo trách nhiệm bản dịch.");
}

/** Shared eligibility for ingestion, retrieval and approved offline guidance. */
export function isEligiblePublishedSource(
	version: SourceVersion | undefined,
	currentId: string | null
): boolean {
	if (
		!version ||
		version.status !== DocumentStatus.PUBLISHED ||
		version.id !== currentId ||
		!version.publishedBy ||
		!version.publishedAt ||
		!version.fileRef ||
		version.contentType !== "application/pdf" ||
		!/^[a-f0-9]{64}$/.test(version.checksum)
	)
		return false;
	return isEligibleSourceContent(version);
}

export function sourceContentIssue(source: SourceVersion): string | null {
	const { metadata, rights } = source;
	try {
		validatePublishedSourceMetadata(metadata);
	} catch {
		return "Thông tin nguồn PDF không hợp lệ.";
	}
	const medical = [Classification.FIRST_AID, Classification.MEDICAL_REFERENCE].includes(
		metadata.classification
	);
	if (
		!rights ||
		![RightsStatus.NOT_REVIEWED, RightsStatus.PERMITTED].includes(rights.rightsReviewStatus)
	)
		return "Nguồn PDF đang bị hạn chế sử dụng.";
	if (medical && rights.medicalContentReviewStatus === MedicalStatus.REJECTED)
		return "Nội dung sơ cứu hoặc y tế đã bị từ chối sử dụng.";
	if (isTranslation(metadata) && rights.translationAllowed !== true)
		return "Phiên bản dịch chưa có xác nhận quyền dịch hoặc chuyển thể.";
	try {
		assertApprovedSource(source);
	} catch {
		return SOURCE_NOT_APPROVED;
	}
	return null;
}

export function isEligibleSourceContent(version: SourceVersion): boolean {
	return sourceContentIssue(version) === null;
}

export function validatePublicationMetadata(metadata: SourceMetadata): void {
	validatePublishedSourceMetadata(metadata);
	if (
		!metadata.licenseType?.trim() ||
		!metadata.permissionEvidence?.trim() ||
		!metadata.attribution?.trim()
	)
		throw invalidSource("Cần giấy phép, minh chứng quyền sử dụng và ghi công trước khi xuất bản.");
}
export function assertRights(
	metadata: SourceMetadata,
	rights: SourceRights,
	use: SourceUse = "AI"
): void {
	if (
		rights?.rightsReviewStatus !== RightsStatus.PERMITTED ||
		rights.sourceReviewConfirmed !== true ||
		rights.internalRagUseAllowed !== true ||
		typeof rights.evidence !== "string" ||
		rights.evidence.trim().length < 10
	)
		throw invalidSource("Chưa xác minh nguồn và quyền lưu trữ, xử lý bằng AI cho đúng tài liệu.");
	if (
		[Classification.FIRST_AID, Classification.MEDICAL_REFERENCE].includes(
			metadata.classification
		) &&
		rights.medicalContentReviewStatus === MedicalStatus.REJECTED
	)
		throw invalidSource("Nội dung sơ cứu hoặc y tế đã bị từ chối sử dụng.");
	if ((isTranslation(metadata) || use === "TRANSLATION") && rights.translationAllowed !== true)
		throw invalidSource("Chưa xác minh quyền dịch hoặc chuyển thể.");
	if (use === "OFFLINE" && rights.offlineRedistributionAllowed !== true)
		throw invalidSource("Chưa xác minh quyền phân phối ngoại tuyến.");
}
