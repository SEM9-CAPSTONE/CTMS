import { z } from "zod";

const optionalText = (schema: z.ZodString) =>
	schema
		.optional()
		.or(z.literal(""))
		.transform((value) => value || undefined);
const https = z
	.string()
	.trim()
	.url("Nhập đường dẫn HTTPS hợp lệ")
	.regex(/^https:\/\//i, "Đường dẫn phải dùng HTTPS")
	.max(2000);
const locale = z
	.string()
	.trim()
	.regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, "Ví dụ vi, en, vi-VN");

export const sourceSchema = z.object({
	sourceTitle: z.string().trim().min(2, "Nhập tên tài liệu").max(250),
	publisher: optionalText(z.string().trim().min(2).max(250)),
	sourceUrl: optionalText(https),
	classification: z.enum([
		"NATURAL_HAZARDS",
		"TREKKING_SAFETY",
		"WEATHER_SAFETY",
		"WATER_SAFETY",
		"MEDICAL_REFERENCE",
		"FIRST_AID",
	]),
	locale,
	originalLocale: optionalText(locale),
	sourcePublishedAt: optionalText(z.string().date()),
	retrievedAt: optionalText(z.string().date()),
	licenseType: optionalText(z.string().trim().min(2).max(250)),
	licenseUrl: optionalText(https),
	permissionEvidence: optionalText(
		z.string().trim().min(10, "Mô tả rõ minh chứng quyền sử dụng").max(5000)
	),
	changeSummary: optionalText(z.string().trim().min(3).max(2000)),
	attribution: optionalText(z.string().trim().min(3).max(2000)),
	originalVersionId: optionalText(z.string().trim().uuid()),
	adaptationDisclaimer: optionalText(z.string().trim().min(10).max(3000)),
});

export function documentEditorSchema(maxBytes?: number) {
	return z
		.object({
			metadata: sourceSchema,
			method: z.enum(["upload", "url", "edit"]),
			file: z.custom<File>((value) => value instanceof File).optional(),
			sourceUrl: z.string().trim(),
		})
		.superRefine(({ method, file, sourceUrl }, context) => {
			if (method === "url" && !https.safeParse(sourceUrl).success) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["sourceUrl"],
					message: "Nhập URL HTTPS trỏ trực tiếp tới PDF.",
				});
			}
			if (method !== "upload") return;
			if (!file || !file.size || !/\.pdf$/i.test(file.name)) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["file"],
					message: "Chọn tệp PDF.",
				});
			} else if (maxBytes && file.size > maxBytes) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["file"],
					message: `Tệp PDF vượt quá ${Math.round((maxBytes / 1048576) * 10) / 10} MiB.`,
				});
			}
		});
}

export type DocumentEditorValues = z.input<ReturnType<typeof documentEditorSchema>>;
export type ValidatedEditorValues = z.output<ReturnType<typeof documentEditorSchema>>;

export const duplicatePdfSchema = z.object({
	code: z.enum([
		"SOURCE_DUPLICATE_PDF",
		"SOURCE_DUPLICATE_PDF_NAME",
		"SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT",
	]),
	documentId: z.string().uuid(),
	versionId: z.string().uuid(),
	versionNumber: z.number().int().positive(),
	sourceTitle: z.string().min(1),
});

export type DuplicatePdf = z.infer<typeof duplicatePdfSchema>;
