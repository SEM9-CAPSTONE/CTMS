import { z } from "zod";
import { type CreateTrekkingRouteInput, ROUTE_DIFFICULTIES } from "../types";

const positionSchema = z
	.tuple([z.number().finite(), z.number().finite()])
	.refine(([longitude]) => longitude >= -180 && longitude <= 180, "Kinh độ phải từ -180 đến 180")
	.refine(([, latitude]) => latitude >= -90 && latitude <= 90, "Vĩ độ phải từ -90 đến 90");

export const lineStringSchema = z.object({
	type: z.literal("LineString"),
	coordinates: z.array(positionSchema).min(2, "Tuyến đường phải có ít nhất 2 điểm"),
});

export const createTrekkingRouteFormSchema = z.object({
	campsiteId: z.string().uuid("Vui lòng chọn khu cắm trại"),
	name: z
		.string()
		.trim()
		.min(1, "Tên tuyến đường là bắt buộc")
		.max(150, "Tên không được vượt quá 150 ký tự"),
	description: z.string().trim(),
	difficulty: z.enum(ROUTE_DIFFICULTIES),
	expectedDurationMinutes: z
		.string()
		.trim()
		.regex(/^\d+$/, "Thời lượng phải là số nguyên dương")
		.refine((value) => Number(value) > 0, "Thời lượng phải lớn hơn 0"),
	geometry: lineStringSchema,
});

export type CreateTrekkingRouteFormValues = z.infer<typeof createTrekkingRouteFormSchema>;

export const CREATE_TREKKING_ROUTE_DEFAULT_VALUES: CreateTrekkingRouteFormValues = {
	campsiteId: "",
	name: "",
	description: "",
	difficulty: "moderate",
	expectedDurationMinutes: "",
	geometry: { type: "LineString", coordinates: [] },
};

export function toCreateTrekkingRouteInput(
	values: CreateTrekkingRouteFormValues
): CreateTrekkingRouteInput {
	const description = values.description.trim();
	return {
		campsiteId: values.campsiteId,
		name: values.name.trim(),
		...(description ? { description } : {}),
		geometry: values.geometry,
		difficulty: values.difficulty,
		expectedDurationMinutes: Number(values.expectedDurationMinutes),
	};
}
