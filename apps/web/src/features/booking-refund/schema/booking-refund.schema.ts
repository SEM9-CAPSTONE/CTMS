import { z } from "zod";

export const refundRequestSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(5, "Lý do phải có ít nhất 5 ký tự")
		.max(500, "Lý do không được vượt quá 500 ký tự"),
	amount: z
		.string()
		.trim()
		.regex(/^\d+(\.\d{1,2})?$/, "Số tiền phải là số hợp lệ có tối đa 2 chữ số thập phân")
		.optional()
		.or(z.literal("")),
	bankName: z
		.string()
		.trim()
		.max(100, "Tên ngân hàng không được quá 100 ký tự")
		.optional()
		.or(z.literal("")),
	accountNumber: z
		.string()
		.trim()
		.max(50, "Số tài khoản không được quá 50 ký tự")
		.optional()
		.or(z.literal("")),
	accountHolderName: z
		.string()
		.trim()
		.max(100, "Tên chủ tài khoản không được quá 100 ký tự")
		.optional()
		.or(z.literal("")),
	origin: z
		.enum([
			"camper_cancellation",
			"camper_complaint",
			"host_trip_cancellation",
			"system_trip_cancellation",
			"late_payment_after_expiry",
		])
		.optional(),
});

export type RefundRequestFormData = z.infer<typeof refundRequestSchema>;
