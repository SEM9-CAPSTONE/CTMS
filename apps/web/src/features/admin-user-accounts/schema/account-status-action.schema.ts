import { z } from "zod";

export const accountStatusActionSchema = z.object({
	reason: z.string().max(255, "Lý do không được vượt quá 255 ký tự").optional(),
});

export type AccountStatusActionFormValues = z.infer<typeof accountStatusActionSchema>;
