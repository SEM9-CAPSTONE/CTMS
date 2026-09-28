import { z } from "zod";
import { type CreateTripInput, TRIP_TYPES, TRIP_WAYPOINT_TYPES, type Trip } from "../types";

const uuidMessage = "Vui lòng chọn tuyến trekking đã duyệt";
const coordinateMessage = "Tọa độ phải nằm trong phạm vi hợp lệ";

const positiveIntegerString = (message: string) =>
	z
		.string()
		.trim()
		.regex(/^\d+$/, message)
		.refine((value) => Number(value) > 0, message);

const optionalPositiveIntegerString = (message: string) =>
	z
		.string()
		.trim()
		.refine((value) => value === "" || /^\d+$/.test(value), message)
		.refine((value) => value === "" || Number(value) > 0, message);

const nonNegativeMoneyString = z
	.string()
	.trim()
	.regex(/^\d+(\.\d{1,2})?$/, "Giá phải là số không âm, tối đa 2 chữ số thập phân")
	.refine((value) => Number(value) >= 0, "Giá phải lớn hơn hoặc bằng 0");

const coordinateString = z
	.string()
	.trim()
	.regex(/^-?\d+(\.\d+)?$/, coordinateMessage);

function isSameLocalDateTimeInputDate(firstDateTime: string, secondDateTime: string): boolean {
	return firstDateTime.slice(0, 10) === secondDateTime.slice(0, 10);
}

export function inferTripTypeFromSchedule(
	startsAt: string,
	endsAt: string
): CreateTripInput["tripType"] {
	if (!startsAt || !endsAt) return "day_trip";
	return isSameLocalDateTimeInputDate(startsAt, endsAt) ? "day_trip" : "overnight";
}

export const createTripFormSchema = z
	.object({
		routeId: z.string().uuid(uuidMessage),
		title: z
			.string()
			.trim()
			.min(1, "Tên trip là bắt buộc")
			.max(150, "Tên trip không được vượt quá 150 ký tự"),
		description: z.string().trim(),
		coverImageUrl: z
			.string()
			.trim()
			.refine(
				(value) => value === "" || /^https?:\/\/\S+$/i.test(value),
				"URL ảnh bìa chưa hợp lệ"
			),
		tripType: z.enum(TRIP_TYPES, { invalid_type_error: "Loại trip chưa hợp lệ" }),
		startsAt: z.string().min(1, "Thời gian bắt đầu là bắt buộc"),
		endsAt: z.string().min(1, "Thời gian kết thúc là bắt buộc"),
		meetingLongitude: coordinateString.refine(
			(value) => Math.abs(Number(value)) <= 180,
			"Kinh độ phải từ -180 đến 180"
		),
		meetingLatitude: coordinateString.refine(
			(value) => Math.abs(Number(value)) <= 90,
			"Vĩ độ phải từ -90 đến 90"
		),
		meetingAt: z.string(),
		bookingDeadline: z.string().min(1, "Hạn đặt chỗ là bắt buộc"),
		capacityMin: positiveIntegerString("Số khách tối thiểu phải là số nguyên dương"),
		capacityMax: optionalPositiveIntegerString("Số khách tối đa phải là số nguyên dương"),
		pricePerPerson: nonNegativeMoneyString,
		waypoints: z
			.array(
				z.object({
					type: z.enum(TRIP_WAYPOINT_TYPES),
					name: z.string().trim().min(1, "Tên điểm dừng là bắt buộc").max(150),
					longitude: coordinateString.refine(
						(value) => Math.abs(Number(value)) <= 180,
						"Kinh độ phải từ -180 đến 180"
					),
					latitude: coordinateString.refine(
						(value) => Math.abs(Number(value)) <= 90,
						"Vĩ độ phải từ -90 đến 90"
					),
					plannedAt: z.string().min(1, "Thời gian điểm dừng là bắt buộc"),
				})
			)
			.min(2, "Trip cần ít nhất điểm bắt đầu và điểm kết thúc"),
	})
	.superRefine((values, context) => {
		const startsAt = new Date(values.startsAt);
		const endsAt = new Date(values.endsAt);
		const bookingDeadline = new Date(values.bookingDeadline);
		const meetingAt = values.meetingAt ? new Date(values.meetingAt) : null;
		const now = new Date();

		if (values.startsAt && startsAt < now) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["startsAt"],
				message: "Thời gian bắt đầu không được ở quá khứ",
			});
		}
		if (values.endsAt && endsAt < now) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["endsAt"],
				message: "Thời gian kết thúc không được ở quá khứ",
			});
		}
		if (values.bookingDeadline && bookingDeadline < now) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["bookingDeadline"],
				message: "Hạn đặt chỗ không được ở quá khứ",
			});
		}
		if (meetingAt && meetingAt < now) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["meetingAt"],
				message: "Thời gian tập trung không được ở quá khứ",
			});
		}

		if (values.startsAt && values.endsAt && startsAt >= endsAt) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["endsAt"],
				message: "Thời gian kết thúc phải sau thời gian bắt đầu",
			});
		}
		if (values.bookingDeadline && values.startsAt && bookingDeadline >= startsAt) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["bookingDeadline"],
				message: "Hạn đặt chỗ phải trước thời gian bắt đầu",
			});
		}
		if (meetingAt && values.startsAt && meetingAt > startsAt) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["meetingAt"],
				message: "Thời gian tập trung phải trước hoặc bằng thời gian bắt đầu",
			});
		}
		if (values.capacityMax && Number(values.capacityMin) > Number(values.capacityMax)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["capacityMin"],
				message: "Số khách tối thiểu không được lớn hơn số khách tối đa",
			});
		}
		if (!values.waypoints.some((waypoint) => waypoint.type === "start")) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["waypoints"],
				message: "Trip phải có waypoint bắt đầu",
			});
		}
		if (!values.waypoints.some((waypoint) => waypoint.type === "finish")) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["waypoints"],
				message: "Trip phải có waypoint kết thúc",
			});
		}

		const plannedTimes = new Set<string>();
		values.waypoints.forEach((waypoint, index) => {
			if (plannedTimes.has(waypoint.plannedAt)) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints", index, "plannedAt"],
					message: "Thời gian điểm dừng không được trùng trong cùng trip",
				});
			}
			plannedTimes.add(waypoint.plannedAt);
			const plannedAt = new Date(waypoint.plannedAt);
			if (values.startsAt && values.endsAt && (plannedAt < startsAt || plannedAt > endsAt)) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["waypoints", index, "plannedAt"],
					message: "Thời gian điểm dừng phải nằm trong lịch trình trip",
				});
			}
		});

		const sortedWaypoints = [...values.waypoints].sort(
			(first, second) => new Date(first.plannedAt).getTime() - new Date(second.plannedAt).getTime()
		);
		if (sortedWaypoints[0]?.type !== "start") {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["waypoints"],
				message: "Điểm đầu tiên phải là điểm bắt đầu",
			});
		}
		if (sortedWaypoints.at(-1)?.type !== "finish") {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["waypoints"],
				message: "Điểm cuối cùng phải là điểm kết thúc",
			});
		}
	});

export type CreateTripFormValues = z.infer<typeof createTripFormSchema>;

export const CREATE_TRIP_DEFAULT_VALUES: CreateTripFormValues = {
	routeId: "",
	title: "",
	description: "",
	coverImageUrl: "",
	tripType: "day_trip",
	startsAt: "",
	endsAt: "",
	meetingLongitude: "108.2208",
	meetingLatitude: "16.0471",
	meetingAt: "",
	bookingDeadline: "",
	capacityMin: "",
	capacityMax: "",
	pricePerPerson: "0",
	waypoints: [
		{
			type: "start",
			name: "",
			longitude: "108.2208",
			latitude: "16.0471",
			plannedAt: "",
		},
		{
			type: "finish",
			name: "",
			longitude: "108.2508",
			latitude: "16.0671",
			plannedAt: "",
		},
	],
};

function toIsoString(localDateTime: string): string {
	return new Date(localDateTime).toISOString();
}

function toDateTimeLocalValue(value: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return localDate.toISOString().slice(0, 16);
}

export function toCreateTripFormValues(trip: Trip): CreateTripFormValues {
	return {
		routeId: trip.routeId,
		title: trip.title,
		description: trip.description ?? "",
		coverImageUrl: trip.coverImageUrl ?? "",
		tripType: trip.tripType,
		startsAt: toDateTimeLocalValue(trip.startsAt),
		endsAt: toDateTimeLocalValue(trip.endsAt),
		meetingLongitude: String(trip.meetingPoint.coordinates[0]),
		meetingLatitude: String(trip.meetingPoint.coordinates[1]),
		meetingAt: toDateTimeLocalValue(trip.meetingAt),
		bookingDeadline: toDateTimeLocalValue(trip.bookingDeadline),
		capacityMin: String(trip.capacityMin),
		capacityMax: trip.capacityMax == null ? "" : String(trip.capacityMax),
		pricePerPerson: String(trip.pricePerPerson),
		waypoints: trip.waypoints.map((waypoint) => ({
			type: waypoint.type,
			name: waypoint.name,
			longitude: String(waypoint.location.coordinates[0]),
			latitude: String(waypoint.location.coordinates[1]),
			plannedAt: toDateTimeLocalValue(waypoint.plannedAt),
		})),
	};
}

export function toCreateTripInput(values: CreateTripFormValues): CreateTripInput {
	const description = values.description.trim();
	const coverImageUrl = values.coverImageUrl.trim();
	return {
		routeId: values.routeId,
		title: values.title.trim(),
		...(description ? { description } : {}),
		...(coverImageUrl ? { coverImageUrl } : {}),
		tripType: inferTripTypeFromSchedule(values.startsAt, values.endsAt),
		startsAt: toIsoString(values.startsAt),
		endsAt: toIsoString(values.endsAt),
		meetingPoint: {
			type: "Point",
			coordinates: [Number(values.meetingLongitude), Number(values.meetingLatitude)],
		},
		...(values.meetingAt ? { meetingAt: toIsoString(values.meetingAt) } : {}),
		bookingDeadline: toIsoString(values.bookingDeadline),
		capacityMin: Number(values.capacityMin),
		capacityMax: values.capacityMax ? Number(values.capacityMax) : null,
		pricePerPerson: Number(values.pricePerPerson),
		waypoints: values.waypoints.map((waypoint) => ({
			type: waypoint.type,
			name: waypoint.name.trim(),
			location: {
				type: "Point",
				coordinates: [Number(waypoint.longitude), Number(waypoint.latitude)],
			},
			plannedAt: toIsoString(waypoint.plannedAt),
		})),
	};
}
