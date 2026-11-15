import { z } from "zod";

const ACTION_TYPES = [
	"ADD_HAZARD_AREA",
	"UPDATE_HAZARD_AREA",
	"UPDATE_CHECKPOINT_INSTRUCTIONS",
	"NO_DATA_CHANGE",
	"OTHER",
] as const;

export const correctiveActionSchema = z
	.object({
		actionType: z.enum(ACTION_TYPES),
		reason: z
			.string()
			.trim()
			.min(10, "Lý do cần tối thiểu 10 ký tự.")
			.max(1000, "Lý do tối đa 1.000 ký tự."),
		checkpointId: z.string(),
		instructions: z.string().trim().max(1000, "Hướng dẫn tối đa 1.000 ký tự."),
		hazardAreaId: z.string(),
		hazardDescription: z.string().trim().max(1000, "Mô tả tối đa 1.000 ký tự."),
		hazardSeverity: z.enum(["low", "medium", "high"]),
		hazardRadius: z.coerce
			.number({ invalid_type_error: "Bán kính phải là số." })
			.positive("Bán kính phải lớn hơn 0.")
			.max(5000, "Bán kính tối đa 5.000 m."),
	})
	.superRefine((value, ctx) => {
		const need = (path: string, message: string) =>
			ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
		if (value.actionType === "UPDATE_CHECKPOINT_INSTRUCTIONS") {
			if (!value.checkpointId) need("checkpointId", "Chọn điểm dừng cần cập nhật.");
			if (!value.instructions) need("instructions", "Nhập hướng dẫn an toàn mới.");
		}
		if (value.actionType === "UPDATE_HAZARD_AREA" && !value.hazardAreaId) {
			need("hazardAreaId", "Chọn vùng nguy hiểm cần sửa.");
		}
		if (
			(value.actionType === "ADD_HAZARD_AREA" || value.actionType === "UPDATE_HAZARD_AREA") &&
			!value.hazardDescription
		) {
			need("hazardDescription", "Nhập mô tả vùng nguy hiểm.");
		}
	});

export type CorrectiveActionFormInput = z.input<typeof correctiveActionSchema>;
export type CorrectiveActionFormData = z.output<typeof correctiveActionSchema>;
