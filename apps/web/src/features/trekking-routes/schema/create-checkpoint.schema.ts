import { z } from "zod";
import { CHECKPOINT_RADIUS_METERS } from "../constants";
import {
	type CheckpointType,
	type CreateCheckpointInput,
	ROUTE_CHECKPOINT_TYPES,
	type RouteCheckpoint,
	type RouteCheckpointType,
} from "../types";

export const CHECKPOINT_DEFAULT_NAMES: Record<CheckpointType, string> = {
	start: "Điểm bắt đầu",
	rest: "Điểm nghỉ chân",
	water: "Điểm cấp nước",
	dangerous: "Điểm nguy hiểm",
	emergency_shelter: "Nơi trú ẩn khẩn cấp",
	finish: "Điểm kết thúc",
};

const pointSchema = z.object({
	type: z.literal("Point"),
	coordinates: z
		.tuple([z.number().finite(), z.number().finite()])
		.refine(([longitude]) => longitude >= -180 && longitude <= 180, "Kinh độ phải từ -180 đến 180")
		.refine(([, latitude]) => latitude >= -90 && latitude <= 90, "Vĩ độ phải từ -90 đến 90"),
});

const isRouteCheckpointType = (value: string): value is RouteCheckpointType =>
	(ROUTE_CHECKPOINT_TYPES as readonly string[]).includes(value);

export const createCheckpointFormSchema = z.object({
	location: pointSchema,
	// "" lets a legacy start/rest/finish checkpoint open for editing until the host picks a new type.
	type: z
		.string()
		.refine((value): boolean => isRouteCheckpointType(value), "Vui lòng chọn loại vị trí"),
	instructions: z.string().trim().max(1000, "Hướng dẫn không được vượt quá 1000 ký tự"),
});

export type CreateCheckpointFormValues = z.infer<typeof createCheckpointFormSchema>;

export function checkpointDefaultValues(
	location: CreateCheckpointFormValues["location"],
	checkpoint?: RouteCheckpoint
): CreateCheckpointFormValues {
	if (checkpoint) {
		return {
			location: checkpoint.location,
			type: isRouteCheckpointType(checkpoint.type) ? checkpoint.type : "",
			instructions: checkpoint.instructions,
		};
	}
	return { location, type: "water", instructions: "" };
}

export function toCreateCheckpointInput(
	values: CreateCheckpointFormValues,
	checkpoint?: Pick<RouteCheckpoint, "expectedArrivalOffset" | "nearbyWaterOrShelter">
): CreateCheckpointInput {
	const type = values.type as RouteCheckpointType;
	const name = CHECKPOINT_DEFAULT_NAMES[type];
	return {
		name,
		location: values.location,
		radiusMeters: CHECKPOINT_RADIUS_METERS,
		type,
		expectedArrivalOffset: checkpoint?.expectedArrivalOffset ?? 0,
		instructions: values.instructions.trim() || name,
		nearbyWaterOrShelter: checkpoint?.nearbyWaterOrShelter ?? false,
	};
}
