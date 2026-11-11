import { z } from "zod";

export const hostPayoutSchema = z.object({
	bankName: z.string().min(1, "Vui lòng chọn ngân hàng thụ hưởng"),
	accountNumber: z
		.string()
		.min(4, "Số tài khoản phải có ít nhất 4 ký tự")
		.max(50, "Số tài khoản không được vượt quá 50 ký tự")
		.regex(/^[A-Za-z0-9]+$/, "Số tài khoản chỉ bao gồm chữ cái và số"),
	accountHolderName: z
		.string()
		.min(2, "Tên chủ tài khoản phải có ít nhất 2 ký tự")
		.max(100, "Tên chủ tài khoản không được vượt quá 100 ký tự"),
	notes: z.string().max(255, "Ghi chú không được vượt quá 255 ký tự").optional(),
});

export type HostPayoutFormData = z.infer<typeof hostPayoutSchema>;
