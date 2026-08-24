import { z } from "zod";
import type { CreateCampsiteInput } from "../types";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const COORDINATE_PATTERN = /^-?\d+(?:\.\d{1,6})?$/;

function coordinateSchema(label: string, min: number, max: number) {
	return z
		.string()
		.trim()
		.min(1, `${label} là bắt buộc`)
		.refine((value) => COORDINATE_PATTERN.test(value), {
			message: `${label} phải là số và có tối đa 6 chữ số thập phân`,
		})
		.refine(
			(value) => {
				const number = Number(value);
				return Number.isFinite(number) && number >= min && number <= max;
			},
			{
				message: `${label} phải nằm trong khoảng ${min} đến ${max}`,
			}
		);
}

const imageSchema = z.object({
	url: z
		.string()
		.trim()
		.min(1, "URL ảnh là bắt buộc")
		.max(2000, "URL ảnh không được vượt quá 2000 ký tự")
		.url("URL ảnh không hợp lệ")
		.refine(
			(value) => {
				try {
					const url = new URL(value);
					return url.protocol === "http:" || url.protocol === "https:";
				} catch {
					return false;
				}
			},
			{
				message: "URL ảnh phải sử dụng HTTP hoặc HTTPS",
			}
		),

	displayOrder: z
		.string()
		.trim()
		.refine(
			(value) => {
				if (value === "") {
					return true;
				}

				if (!/^\d+$/.test(value)) {
					return false;
				}

				const number = Number(value);
				return Number.isInteger(number) && number >= 0 && number <= 100;
			},
			{
				message: "Thứ tự ảnh phải là số nguyên từ 0 đến 100",
			}
		),
});

export const createCampsiteFormSchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(1, "Tên campsite là bắt buộc")
			.max(150, "Tên campsite không được vượt quá 150 ký tự"),

		description: z
			.string()
			.trim()
			.min(1, "Mô tả là bắt buộc")
			.max(2000, "Mô tả không được vượt quá 2000 ký tự"),

		latitude: coordinateSchema("Vĩ độ", -90, 90),

		longitude: coordinateSchema("Kinh độ", -180, 180),

		province: z
			.string()
			.trim()
			.min(1, "Tỉnh/Thành phố là bắt buộc")
			.max(100, "Tỉnh/Thành phố không được vượt quá 100 ký tự"),

		policies: z
			.string()
			.trim()
			.min(1, "Chính sách là bắt buộc")
			.max(2000, "Chính sách không được vượt quá 2000 ký tự"),

		opensAt: z
			.string()
			.trim()
			.min(1, "Giờ mở cửa là bắt buộc")
			.regex(TIME_PATTERN, "Giờ mở cửa không hợp lệ"),

		closesAt: z
			.string()
			.trim()
			.min(1, "Giờ đóng cửa là bắt buộc")
			.regex(TIME_PATTERN, "Giờ đóng cửa không hợp lệ"),

		initialImages: z
			.array(imageSchema)
			.min(1, "Campsite phải có ít nhất 1 ảnh")
			.max(10, "Campsite chỉ được có tối đa 10 ảnh"),
	})
	.superRefine((data, context) => {
		if (
			TIME_PATTERN.test(data.opensAt) &&
			TIME_PATTERN.test(data.closesAt) &&
			data.opensAt >= data.closesAt
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["closesAt"],
				message: "Giờ đóng cửa phải sau giờ mở cửa",
			});
		}

		const displayOrders = data.initialImages
			.map((image) => image.displayOrder)
			.filter((value) => value !== "");

		const uniqueOrders = new Set(displayOrders);

		if (uniqueOrders.size !== displayOrders.length) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["initialImages"],
				message: "Thứ tự hiển thị của các ảnh không được trùng nhau",
			});
		}
	});

export type CreateCampsiteFormValues = z.infer<typeof createCampsiteFormSchema>;

export const CREATE_CAMPSITE_DEFAULT_VALUES: CreateCampsiteFormValues = {
	name: "",
	description: "",
	latitude: "",
	longitude: "",
	province: "",
	policies: "",
	opensAt: "08:00",
	closesAt: "18:00",
	initialImages: [],
};

export function toCreateCampsiteInput(values: CreateCampsiteFormValues): CreateCampsiteInput {
	return {
		name: values.name.trim(),
		description: values.description.trim(),
		latitude: Number(values.latitude),
		longitude: Number(values.longitude),
		province: values.province.trim(),
		policies: { rules: values.policies.trim() },
		operatingHours: { opensAt: values.opensAt, closesAt: values.closesAt },
		media: values.initialImages.map((image) => ({
			url: image.url.trim(),
			type: "photo",
			...(image.displayOrder !== "" ? { sortOrder: Number(image.displayOrder) } : {}),
		})),
	};
}
