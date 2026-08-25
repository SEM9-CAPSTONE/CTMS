import { z } from "zod";
import type { CreateCampsiteInput, CreatedCampsite, UpdateCampsiteInput } from "../types";

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

	sortOrder: z
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
			.min(1, "Tên khu cắm trại là bắt buộc")
			.max(150, "Tên khu cắm trại không được vượt quá 150 ký tự"),

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

		placeLabel: z
			.string()
			.trim()
			.min(1, "Địa điểm khu cắm trại là bắt buộc")
			.max(500, "Địa điểm khu cắm trại không được vượt quá 500 ký tự"),

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
			.min(1, "Khu cắm trại phải có ít nhất 1 ảnh")
			.max(10, "Khu cắm trại chỉ được có tối đa 10 ảnh"),
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
			.map((image) => image.sortOrder)
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
	placeLabel: "",
	policies: "",
	opensAt: "08:00",
	closesAt: "18:00",
	initialImages: [],
};

const CREATE_CAMPSITE_DRAFT_STORAGE_KEY = "ctms.createCampsiteDraft";

function draftString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

export function loadCreateCampsiteDraft(): CreateCampsiteFormValues {
	if (typeof localStorage === "undefined") {
		return CREATE_CAMPSITE_DEFAULT_VALUES;
	}

	try {
		const rawDraft = localStorage.getItem(CREATE_CAMPSITE_DRAFT_STORAGE_KEY);
		if (!rawDraft) {
			return CREATE_CAMPSITE_DEFAULT_VALUES;
		}

		const draft = JSON.parse(rawDraft) as Partial<CreateCampsiteFormValues>;

		return {
			...CREATE_CAMPSITE_DEFAULT_VALUES,
			name: draftString(draft.name),
			description: draftString(draft.description),
			latitude: draftString(draft.latitude),
			longitude: draftString(draft.longitude),
			province: draftString(draft.province),
			placeLabel: draftString(draft.placeLabel),
			policies: draftString(draft.policies),
			opensAt: draftString(draft.opensAt, CREATE_CAMPSITE_DEFAULT_VALUES.opensAt),
			closesAt: draftString(draft.closesAt, CREATE_CAMPSITE_DEFAULT_VALUES.closesAt),
			initialImages: Array.isArray(draft.initialImages) ? draft.initialImages : [],
		};
	} catch {
		return CREATE_CAMPSITE_DEFAULT_VALUES;
	}
}

export function saveCreateCampsiteDraft(values: CreateCampsiteFormValues): void {
	if (typeof localStorage === "undefined") {
		return;
	}

	localStorage.setItem(CREATE_CAMPSITE_DRAFT_STORAGE_KEY, JSON.stringify(values));
}

export function clearCreateCampsiteDraft(): void {
	if (typeof localStorage === "undefined") {
		return;
	}

	localStorage.removeItem(CREATE_CAMPSITE_DRAFT_STORAGE_KEY);
}

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
			...(image.sortOrder !== "" ? { sortOrder: Number(image.sortOrder) } : {}),
		})),
	};
}

export function toEditCampsiteFormValues(campsite: CreatedCampsite): CreateCampsiteFormValues {
	return {
		name: campsite.name,
		description: campsite.description,
		latitude: String(Number(campsite.latitude.toFixed(6))),
		longitude: String(Number(campsite.longitude.toFixed(6))),
		province: campsite.province,
		placeLabel: campsite.province,
		policies: campsite.policies?.rules ?? "",
		opensAt: campsite.operatingHours?.opensAt ?? CREATE_CAMPSITE_DEFAULT_VALUES.opensAt,
		closesAt: campsite.operatingHours?.closesAt ?? CREATE_CAMPSITE_DEFAULT_VALUES.closesAt,
		initialImages: campsite.media.map((image) => ({
			url: image.url,
			sortOrder: String(image.sortOrder),
		})),
	};
}

export function toUpdateCampsiteInput(
	values: CreateCampsiteFormValues,
	expectedUpdatedAt: string
): UpdateCampsiteInput {
	return {
		...toCreateCampsiteInput(values),
		expectedUpdatedAt,
		changeReason: "host_edit_campsite",
	};
}

export const updateCampsiteMediaSchema = z
	.object({
		initialImages: z
			.array(imageSchema)
			.min(1, "Khu cắm trại phải có ít nhất 1 ảnh")
			.max(10, "Khu cắm trại chỉ được có tối đa 10 ảnh"),
	})
	.superRefine((data, context) => {
		const displayOrders = data.initialImages
			.map((image) => image.sortOrder)
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

export type UpdateCampsiteMediaFormValues = z.infer<typeof updateCampsiteMediaSchema>;
