import { z } from "zod";
import { ROUTE_DANGER_ZONE_SEVERITIES } from "../../trekking-routes/types";

const HAZARD_TYPES = [
	"ROUTE_OBSTRUCTION",
	"LOST_MEMBER",
	"SLIPPERY_OR_LANDSLIDE",
	"DAMAGED_BARRIER",
	"WILDLIFE",
	"OTHER",
] as const;

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
	reason: z.string().trim().max(1000, "Ghi chú tối đa 1.000 ký tự."),
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

export const hostProposalSchema = z
	.object({
		hazardType: z.enum(HAZARD_TYPES),
		severity: z.enum(ROUTE_DANGER_ZONE_SEVERITIES),
		description,
		radiusMeters: radius,
		location: z
			.object({
				type: z.literal("Point"),
				coordinates: z.tuple([z.number().finite(), z.number().finite()]),
			})
			.optional(),
	})
	.superRefine((values, context) => {
		if (!values.location) {
			context.addIssue({
				code: "custom",
				path: ["location"],
				message: "Vui lòng chọn vị trí trên bản đồ.",
			});
		}
	});
export type HostProposalFormInput = z.input<typeof hostProposalSchema>;
export type HostProposalFormData = z.output<typeof hostProposalSchema>;
