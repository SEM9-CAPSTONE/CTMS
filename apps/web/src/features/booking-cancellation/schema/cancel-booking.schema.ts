import { z } from "zod";

export const cancelBookingSchema = z
	.object({
		reason: z.string().trim().max(255, "Lý do không được vượt quá 255 ký tự.").optional(),
	})
	.strict();
