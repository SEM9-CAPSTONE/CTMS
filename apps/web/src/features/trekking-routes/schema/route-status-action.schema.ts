import { z } from "zod";

export const routeStatusActionSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(1, "Vui lòng nhập lý do thay đổi trạng thái tuyến đường.")
		.max(255, "Lý do không được vượt quá 255 ký tự."),
});

export type RouteStatusActionFormValues = z.infer<typeof routeStatusActionSchema>;
