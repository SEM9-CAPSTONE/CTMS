import { z } from "zod";

export const reviewTrekkingRouteSchema = z
	.object({
		action: z.enum(["approve", "decline", "non_operable"]),
		reason: z
			.string()
			.optional()
			.transform((value) => value?.trim() || "")
			.refine((value) => value.length <= 255, "Lý do không được vượt quá 255 ký tự."),
	})
	.superRefine((values, context) => {
		if (values.action !== "approve" && !values.reason) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Lý do là bắt buộc cho quyết định này.",
				path: ["reason"],
			});
		}
	});

export type ReviewTrekkingRouteFormValues = z.infer<typeof reviewTrekkingRouteSchema>;
