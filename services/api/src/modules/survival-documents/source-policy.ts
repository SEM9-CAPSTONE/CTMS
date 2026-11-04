import { isIP } from "node:net";
import { invalidSource } from "./dto/source.dto";
import {
	Classification,
	MedicalStatus,
	RightsStatus,
	type SourceMetadata,
	type SourceRights,
	type SourceUse,
} from "./survival-documents.types";

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
		const host = url.hostname.toLowerCase();
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
	const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(
		new Date()
	);
	const retrievedEnd = isDateOnly(metadata.retrievedAt)
		? `${metadata.retrievedAt}T23:59:59.999+07:00`
		: metadata.retrievedAt;
	const publication =
		metadata.sourcePublishedAt && isDateOnly(metadata.sourcePublishedAt)
			? `${metadata.sourcePublishedAt}T00:00:00+07:00`
			: metadata.sourcePublishedAt;
	const retrievedInFuture = isDateOnly(metadata.retrievedAt)
		? metadata.retrievedAt > today
		: new Date(metadata.retrievedAt).getTime() > Date.now() + 60_000;
	if (
		retrievedInFuture ||
		(publication && new Date(publication).getTime() > new Date(retrievedEnd).getTime())
	)
		throw invalidSource("Ngày xuất bản và ngày truy cập không hợp lệ.");
	if (
		metadata.locale !== metadata.originalLocale &&
		(!metadata.originalVersionId || !metadata.adaptationDisclaimer)
	)
		throw invalidSource("Bản dịch cần phiên bản gốc và thông báo trách nhiệm bản dịch.");
}
export function assertRights(
	metadata: SourceMetadata,
	rights: SourceRights,
	use: SourceUse = "AI"
): void {
	if (
		rights.rightsReviewStatus !== RightsStatus.PERMITTED ||
		!rights.sourceReviewConfirmed ||
		!rights.internalRagUseAllowed ||
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
	if (
		(metadata.locale !== metadata.originalLocale || use === "TRANSLATION") &&
		!rights.translationAllowed
	)
		throw invalidSource("Chưa xác minh quyền dịch hoặc chuyển thể.");
	if (use === "OFFLINE" && !rights.offlineRedistributionAllowed)
		throw invalidSource("Chưa xác minh quyền phân phối ngoại tuyến.");
}
