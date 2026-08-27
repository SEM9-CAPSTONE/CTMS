import { z } from "zod";

export const reviewCampsiteSchema = z
	.object({
		action: z.enum(["approve", "decline"], {
			required_error: "Vui lòng chọn hành động phê duyệt hoặc từ chối.",
		}),
		reason: z
			.string()
			.max(500, "Lý do từ chối không được vượt quá 500 ký tự.")
			.optional()
			.transform((val) => val?.trim() || ""),
	})
	.superRefine((data, ctx) => {
		if (data.action === "decline" && !data.reason) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Lý do từ chối là bắt buộc.",
				path: ["reason"],
			});
		}
	});

export type ReviewCampsiteFormValues = z.infer<typeof reviewCampsiteSchema>;
