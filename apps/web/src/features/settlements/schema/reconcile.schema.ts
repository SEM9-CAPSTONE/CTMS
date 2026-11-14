import { z } from "zod";

export const reconcileExceptionSchema = z.object({
	bookingId: z.string().uuid("Vui lòng chọn đơn đặt chỗ"),
	reason: z
		.string()
		.min(10, "Lý do phải có ít nhất 10 ký tự")
		.max(1000, "Lý do không được vượt quá 1000 ký tự"),
	notes: z.string().max(500, "Ghi chú không được vượt quá 500 ký tự").optional(),
});

export type ReconcileExceptionFormData = z.infer<typeof reconcileExceptionSchema>;

export const resolveAdjustmentSchema = z.object({
	notes: z.string().max(500, "Ghi chú không được vượt quá 500 ký tự").optional(),
});

export type ResolveAdjustmentFormData = z.infer<typeof resolveAdjustmentSchema>;
