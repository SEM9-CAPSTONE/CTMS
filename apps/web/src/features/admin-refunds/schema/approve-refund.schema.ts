import { z } from "zod";

export const approveRefundSchema = z.object({
	note: z.string().trim().max(1000, "Lý do tối đa 1.000 ký tự."),
});
export type ApproveRefundFormData = z.infer<typeof approveRefundSchema>;
