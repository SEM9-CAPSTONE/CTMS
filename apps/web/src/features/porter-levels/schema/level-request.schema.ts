import { z } from "zod";
export const requestFilesSchema = z
	.custom<FileList>()
	.optional()
	.refine((files) => !files || files.length <= 5, "Tối đa 5 tệp minh chứng")
	.refine(
		(files) =>
			!files || Array.from(files).every((file) => file.size > 0 && file.size <= 5 * 1024 * 1024),
		"Mỗi tệp phải có nội dung và không quá 5 MB"
	);
export const createRequestSchema = z.object({
	qualificationId: z.string().min(1, "Chọn tuyến đã khai báo"),
	targetLevel: z.enum(["learning", "proficient", "expert"]),
	reason: z.string().trim().min(1, "Nhập lý do yêu cầu").max(2000),
	files: requestFilesSchema,
});
export const requestReviewSchema = z.object({
	action: z.enum(["approve", "reject", "request-info"]),
	reason: z.string().trim().min(1, "Vui lòng nhập lý do quyết định").max(2000),
});
export const resubmitRequestSchema = z.object({
	reason: z.string().trim().min(1, "Nhập lý do yêu cầu").max(2000),
	files: requestFilesSchema,
});
export const requestFilterSchema = z.object({
	search: z.string().trim().max(100, "Tối đa 100 ký tự"),
});
