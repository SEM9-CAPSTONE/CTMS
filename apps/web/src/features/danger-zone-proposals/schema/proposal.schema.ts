import { z } from "zod";
import { ROUTE_DANGER_ZONE_SEVERITIES } from "../../trekking-routes/types";

const description = z
	.string()
	.trim()
	.min(1, "Vui lòng nhập mô tả.")
	.max(1000, "Mô tả tối đa 1.000 ký tự.");

const radius = z.coerce
	.number({ invalid_type_error: "Bán kính phải là số." })
	.positive("Bán kính phải lớn hơn 0.")
	.max(5000, "Bán kính tối đa 5.000 m.");

export const approveProposalSchema = z.object({
	severity: z.enum(ROUTE_DANGER_ZONE_SEVERITIES),
	description,
	radiusMeters: radius.optional(),
});
export type ApproveProposalFormInput = z.input<typeof approveProposalSchema>;
export type ApproveProposalFormData = z.output<typeof approveProposalSchema>;

export const rejectProposalSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(10, "Lý do cần tối thiểu 10 ký tự.")
		.max(1000, "Lý do tối đa 1.000 ký tự."),
});
export type RejectProposalFormData = z.infer<typeof rejectProposalSchema>;
