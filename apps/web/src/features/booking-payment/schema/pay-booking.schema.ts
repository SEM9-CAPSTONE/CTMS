import { z } from "zod";
import type { PaymentMethodOption } from "../types";

export const PAYMENT_METHOD_OPTIONS: readonly PaymentMethodOption[] = [
	{
		id: "CARD",
		label: "Thẻ quốc tế / Thẻ nội địa",
		description: "Thanh toán an toàn qua thẻ Visa, Mastercard, JCB hoặc Napas",
		disabled: true,
		badge: "Chưa hỗ trợ",
	},
	{
		id: "BANK_TRANSFER",
		label: "Chuyển khoản ngân hàng",
		description: "Quét mã VietQR hoặc chuyển khoản trực tiếp 24/7",
		disabled: false,
	},
] as const;

export const DEFAULT_PAYMENT_METHOD = "BANK_TRANSFER";

export const payBookingSchema = z.object({
	method: z
		.string({ required_error: "Vui lòng chọn phương thức thanh toán" })
		.trim()
		.min(1, "Vui lòng chọn phương thức thanh toán")
		.max(64, "Phương thức thanh toán không được vượt quá 64 ký tự"),
});

export type PayBookingFormValues = z.infer<typeof payBookingSchema>;
