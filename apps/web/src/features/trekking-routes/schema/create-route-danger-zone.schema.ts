import { z } from "zod";
import { type CreateRouteDangerZoneInput, ROUTE_DANGER_ZONE_SEVERITIES } from "../types";

const positionSchema = z
	.tuple([z.number().finite(), z.number().finite()])
	.refine(([longitude]) => longitude >= -180 && longitude <= 180, "Kinh độ phải từ -180 đến 180")
	.refine(([, latitude]) => latitude >= -90 && latitude <= 90, "Vĩ độ phải từ -90 đến 90");

const pointGeometrySchema = z.object({
	type: z.literal("Point"),
	coordinates: positionSchema,
});

const polygonGeometrySchema = z.object({
	type: z.literal("Polygon"),
	coordinates: z
		.array(
			z
				.array(positionSchema)
				.min(4, "Đa giác cần ít nhất 3 đỉnh và một điểm đóng vòng")
				.superRefine((ring, context) => {
					const first = ring[0];
					const last = ring.at(-1);
					if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
						context.addIssue({ code: "custom", message: "Vòng đa giác phải được đóng" });
					}
					const distinctVertices = new Set(
						ring.slice(0, -1).map(([longitude, latitude]) => `${longitude},${latitude}`)
					);
					if (distinctVertices.size < 3) {
						context.addIssue({ code: "custom", message: "Đa giác cần ít nhất 3 đỉnh khác nhau" });
					}
				})
		)
		.min(1, "Đa giác cần ít nhất một vòng"),
});

export const routeDangerZoneGeometrySchema = z.union([pointGeometrySchema, polygonGeometrySchema]);

export const createRouteDangerZoneFormSchema = z
	.object({
		geometry: routeDangerZoneGeometrySchema.optional(),
		radiusMeters: z.string(),
		description: z
			.string()
			.trim()
			.min(1, "Mô tả khu vực nguy hiểm là bắt buộc")
			.max(1000, "Mô tả không được vượt quá 1000 ký tự"),
		severity: z.enum(ROUTE_DANGER_ZONE_SEVERITIES),
	})
	.superRefine((values, context) => {
		if (!values.geometry) {
			context.addIssue({
				code: "custom",
				path: ["geometry"],
				message: "Vui lòng chọn hình học trên bản đồ",
			});
			return;
		}
		const radius = values.radiusMeters.trim();
		if (values.geometry.type === "Point") {
			const number = Number(radius);
			if (!radius || !Number.isFinite(number) || number <= 0) {
				context.addIssue({
					code: "custom",
					path: ["radiusMeters"],
					message: "Bán kính điểm nguy hiểm phải là số hữu hạn lớn hơn 0",
				});
			}
		} else if (radius) {
			context.addIssue({
				code: "custom",
				path: ["radiusMeters"],
				message: "Đa giác không được có bán kính",
			});
		}
	});

export type CreateRouteDangerZoneFormValues = z.infer<typeof createRouteDangerZoneFormSchema>;

export const routeDangerZoneDefaultValues: CreateRouteDangerZoneFormValues = {
	geometry: undefined,
	radiusMeters: "30",
	description: "",
	severity: "medium",
};

export function toCreateRouteDangerZoneInput(
	values: CreateRouteDangerZoneFormValues
): CreateRouteDangerZoneInput {
	if (!values.geometry) throw new Error("Hazard geometry must be validated before conversion");
	const common = { description: values.description.trim(), severity: values.severity };
	if (values.geometry.type === "Point") {
		return { ...common, geometry: values.geometry, radiusMeters: Number(values.radiusMeters) };
	}
	return { ...common, geometry: values.geometry };
}
