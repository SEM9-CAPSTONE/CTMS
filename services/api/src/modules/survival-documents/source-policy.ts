import { isIP } from "node:net";
import { invalidSource, validateMetadata } from "./dto/source.dto";
import {
	Classification,
	MedicalStatus,
	RightsStatus,
	type SourceMetadata,
	type SourceRights,
	type SourceUse,
	type SourceVersion,
} from "./survival-documents.types";

export function hasRecordedUseRights(version?: SourceVersion): boolean {
	return (
		!!version?.reviewedBy &&
		!!version.reviewedAt &&
		version.rights.rightsReviewStatus === RightsStatus.PERMITTED
	);
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

export function validatePublicationMetadata(metadata: SourceMetadata): void {
	validateMetadata(metadata);
	validateSourceMetadata(metadata);
	if (
		!metadata.licenseType?.trim() ||
		!metadata.permissionEvidence?.trim() ||
		!metadata.attribution?.trim()
	)
		throw invalidSource("Cần giấy phép, minh chứng quyền sử dụng và ghi công trước khi xuất bản.");
	if (isTranslation(metadata) && (!metadata.originalVersionId || !metadata.adaptationDisclaimer))
		throw invalidSource("Bản dịch cần phiên bản gốc và thông báo trách nhiệm bản dịch.");
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
		rights.medicalContentReviewStatus !== MedicalStatus.APPROVED
	)
		throw invalidSource("Tài liệu y tế cần được xác nhận kiểm tra chuyên môn.");
	if ((isTranslation(metadata) || use === "TRANSLATION") && rights.translationAllowed !== true)
		throw invalidSource("Chưa xác minh quyền dịch hoặc chuyển thể.");
	if (use === "OFFLINE" && rights.offlineRedistributionAllowed !== true)
		throw invalidSource("Chưa xác minh quyền phân phối ngoại tuyến.");
}
