import { z } from "zod";

export const createBankAccountSchema = z.object({
	bankName: z.string().min(1, "Vui lòng chọn ngân hàng"),
	accountNumber: z
		.string()
		.min(6, "Số tài khoản phải từ 6 ký tự trở lên")
		.max(20, "Số tài khoản không quá 20 ký tự")
		.regex(/^[0-9A-Za-z]+$/, "Số tài khoản chỉ chứa số hoặc chữ"),
	accountHolderName: z
		.string()
		.min(2, "Tên chủ tài khoản phải từ 2 ký tự trở lên")
		.max(100, "Tên chủ tài khoản không quá 100 ký tự"),
	isDefault: z.boolean().optional(),
});

export type CreateBankAccountFormData = z.infer<typeof createBankAccountSchema>;
