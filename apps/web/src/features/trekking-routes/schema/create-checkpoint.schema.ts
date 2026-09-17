import { z } from "zod";
import {
	CHECKPOINT_TYPES,
	type CheckpointType,
	type CreateCheckpointInput,
	type RouteCheckpoint,
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

export const createCheckpointFormSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Tên checkpoint là bắt buộc")
		.max(150, "Tên không được vượt quá 150 ký tự"),
	location: pointSchema,
	radiusMeters: z
		.string()
		.trim()
		.regex(/^\d+$/, "Bán kính phải là số nguyên")
		.refine(
			(value) => Number(value) >= 10 && Number(value) <= 500,
			"Bán kính phải từ 10 đến 500 mét"
		),
	type: z.enum(CHECKPOINT_TYPES),
	expectedArrivalOffset: z
		.string()
		.trim()
		.regex(/^\d+$/, "Thời gian đến phải là số nguyên không âm"),
	instructions: z
		.string()
		.trim()
		.min(1, "Hướng dẫn là bắt buộc")
		.max(1000, "Hướng dẫn không được vượt quá 1000 ký tự"),
	nearbyWaterOrShelter: z.boolean(),
});

export type CreateCheckpointFormValues = z.infer<typeof createCheckpointFormSchema>;

export function checkpointDefaultValues(
	location: CreateCheckpointFormValues["location"],
	checkpoint?: RouteCheckpoint
): CreateCheckpointFormValues {
	if (checkpoint) {
		return {
			name: checkpoint.name,
			location: checkpoint.location,
			radiusMeters: String(checkpoint.radiusMeters),
			type: checkpoint.type,
			expectedArrivalOffset: String(checkpoint.expectedArrivalOffset),
			instructions: checkpoint.instructions,
			nearbyWaterOrShelter: checkpoint.nearbyWaterOrShelter,
		};
	}
	return {
		name: CHECKPOINT_DEFAULT_NAMES.rest,
		location,
		radiusMeters: "30",
		type: "rest",
		expectedArrivalOffset: "0",
		instructions: "",
		nearbyWaterOrShelter: false,
	};
}

export function toCreateCheckpointInput(values: CreateCheckpointFormValues): CreateCheckpointInput {
	return {
		name: values.name.trim(),
		location: values.location,
		radiusMeters: Number(values.radiusMeters),
		type: values.type,
		expectedArrivalOffset: Number(values.expectedArrivalOffset),
		instructions: values.instructions.trim(),
		nearbyWaterOrShelter: values.nearbyWaterOrShelter,
	};
}
