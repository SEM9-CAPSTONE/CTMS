import { z } from "zod";

export const cancelBookingSchema = z
	.object({
		reason: z
			.string()
			.trim()
			.min(1, "Vui lòng nhập lý do hủy chuyến.")
			.max(255, "Lý do không được vượt quá 255 ký tự."),
	})
	.strict();
