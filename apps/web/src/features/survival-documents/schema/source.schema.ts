import { z } from "zod";
const optionalText = (schema: z.ZodString) =>
	schema
		.optional()
		.or(z.literal(""))
		.transform((value) => value || undefined);
const https = z
	.string()
	.url("Đường dẫn không hợp lệ")
	.startsWith("https://", "Đường dẫn phải dùng HTTPS")
	.max(2000);
export const sourceSchema = z.object({
	sourceTitle: z.string().trim().min(2, "Nhập tên tài liệu").max(250),
	publisher: z.string().trim().min(2, "Nhập tổ chức xuất bản").max(250),
	sourceUrl: optionalText(https),
	classification: z.enum([
		"NATURAL_HAZARDS",
		"TREKKING_SAFETY",
		"WEATHER_SAFETY",
		"WATER_SAFETY",
		"MEDICAL_REFERENCE",
		"FIRST_AID",
	]),
	locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, "Ví dụ: vi, en, vi-VN"),
	originalLocale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, "Ví dụ: vi, en"),
	sourcePublishedAt: optionalText(z.string().date()),
	retrievedAt: z.string().date("Nhập ngày truy cập"),
	licenseType: z.string().trim().min(2, "Nhập loại giấy phép").max(250),
	licenseUrl: optionalText(https),
	permissionEvidence: z
		.string()
		.trim()
		.min(10, "Nhập minh chứng quyền sử dụng của đúng tài liệu")
		.max(5000),
	changeSummary: z.string().trim().min(3, "Nhập nội dung thay đổi").max(2000),
	attribution: z.string().trim().min(3, "Nhập thông tin ghi công nguồn").max(2000),
	originalVersionId: optionalText(z.string().uuid()),
	adaptationDisclaimer: optionalText(z.string().min(10).max(3000)),
});
export type SourceFormValues = z.input<typeof sourceSchema>;
