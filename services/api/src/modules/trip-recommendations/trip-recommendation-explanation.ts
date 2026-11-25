import { evaluateTripBookingEligibility } from "../bookings/trip-booking-eligibility";
import type { FitnessLevel } from "../profiles/entities/health-profile.entity";
import type { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";
import { TRIP_ACTIVITIES } from "../trips/trip-activities";
import { assessTripHealth } from "./trip-health-assessment";
import {
	HISTORY_REASON_MIN_SHARE,
	type HistoryProfile,
	type TripPreferences,
	declaredExperienceMatches,
	fitnessFit,
	isLongRoute,
	priceBand,
} from "./trip-recommendation.policy";
import type { ExplanationProfile, ExplanationTripRow } from "./trip-recommendations.repository";
import { TRIP_REGIONS, type TripRegionCode } from "./trip-regions";

/**
 * CTMS-106 "Vì sao gợi ý chuyến này". Each point quotes what the Camper entered (profile, health
 * profile, trip preferences) or what their history shows, compares it with the Trip's stored facts,
 * and concludes. Written by the server from templates: no AI text, no token cost, and nothing here
 * is sent to the AI. Shown only to the Camper themselves.
 */
export type ExplanationKind =
	| "trip_type"
	| "fitness"
	| "difficulty"
	| "health_note"
	| "allergy"
	| "diet"
	| "age"
	| "interest"
	| "experience"
	| "region"
	| "price"
	| "route"
	| "timing"
	| "availability";

/** match: why it fits; info: useful facts; caution: what to weigh before booking. */
export type ExplanationTone = "match" | "info" | "caution";

export type ExplanationSource =
	| "health_profile"
	| "personal_profile"
	| "trip_preferences"
	| "booking_history";

export interface ExplanationQuote {
	source: ExplanationSource;
	/** e.g. "Mức thể lực" */
	field: string;
	/** What the Camper entered, verbatim (or the label of the option they picked). */
	text: string;
}

export interface ExplanationSection {
	kind: ExplanationKind;
	tone: ExplanationTone;
	title: string;
	/** What the Camper provided; null for facts that come only from the Trip. */
	quote: ExplanationQuote | null;
	/** How the Trip compares with it, using the Trip's stored figures. */
	detail: string;
	/** "Vì vậy …" */
	conclusion: string | null;
}

export interface Explanation {
	sections: ExplanationSection[];
	/** One-paragraph "Vì vậy chuyến này phù hợp với bạn…" over all sections. */
	summary: string;
}

export interface ExplanationInput {
	trip: ExplanationTripRow;
	preferences: TripPreferences;
	history: HistoryProfile;
	profile: ExplanationProfile;
	now: Date;
}

const TRIP_TYPE_LABEL: Record<string, string> = { day_trip: "Trong ngày", overnight: "Qua đêm" };
const DIFFICULTY_LABEL: Record<string, string> = {
	easy: "Dễ",
	moderate: "Trung bình",
	hard: "Khó",
	expert: "Chuyên gia",
};
/** Same wording as the option the Camper picked in the health profile form. */
const FITNESS_LABEL: Record<string, string> = {
	BEGINNER: "Mới bắt đầu (Chưa trekking nhiều)",
	INTERMEDIATE: "Trung bình (Đã đi 2-5 cung đường)",
	ADVANCED: "Nâng cao (Trekking đèo dốc thường xuyên)",
	EXPERT: "Chuyên gia (Chinh phục các đỉnh khắc nghiệt)",
};
const PRICE_BAND_LABEL: Record<string, string> = {
	under_500k: "dưới 500.000 đ",
	"500k_1500k": "từ 500.000 đ đến dưới 1.500.000 đ",
	"1500k_3000k": "từ 1.500.000 đ đến dưới 3.000.000 đ",
	over_3000k: "từ 3.000.000 đ trở lên",
};
const SUMMARY_LABEL: Partial<Record<ExplanationKind, string>> = {
	trip_type: "loại chuyến",
	fitness: "thể lực",
	difficulty: "độ khó",
	interest: "điều bạn yêu thích",
	experience: "kinh nghiệm",
	region: "khu vực",
	price: "mức giá",
	health_note: "bệnh nền",
	age: "độ tuổi",
	availability: "tình trạng đặt chỗ",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SENIOR_AGE = 60;

const vnd = (amount: number) => `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
const km = (meters: number) =>
	`${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
const date = (value: Date) =>
	new Intl.DateTimeFormat("vi-VN", {
		timeZone: "Asia/Ho_Chi_Minh",
		weekday: "long",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(value);
const quoted = (values: string[]) => values.map((value) => `“${value}”`).join(", ");

function duration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const rest = Math.round(minutes % 60);
	if (hours === 0) return `${rest} phút`;
	return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`;
}

function regionLabel(region: TripRegionCode | string | null): string | null {
	return TRIP_REGIONS.find((item) => item.code === region)?.label ?? null;
}

/** "dài 8,5 km, đi bộ khoảng 4 giờ 30 phút" or null. */
function effortFacts(trip: ExplanationTripRow): string | null {
	const parts: string[] = [];
	if (trip.routeLengthMeters !== null && trip.routeLengthMeters > 0) {
		parts.push(`dài ${km(trip.routeLengthMeters)}`);
	}
	if (trip.routeDurationMinutes !== null && trip.routeDurationMinutes > 0) {
		parts.push(`đi bộ khoảng ${duration(trip.routeDurationMinutes)}`);
	}
	return parts.length > 0 ? parts.join(", ") : null;
}

function difficultyPhrase(trip: ExplanationTripRow): string {
	const level = trip.difficulty ? (DIFFICULTY_LABEL[trip.difficulty] ?? trip.difficulty) : null;
	const effort = effortFacts(trip);
	const head = level ? `Cung đường có độ khó ${level}` : "Cung đường";
	return effort ? `${head}, ${effort}` : head;
}

/** "3 trong 5 chuyến gần đây" from an aggregated share; null below the shown threshold. */
function historyCount(share: number | undefined, history: HistoryProfile): string | null {
	if (!share || share < HISTORY_REASON_MIN_SHARE || history.bookingCount === 0) return null;
	const count = Math.max(1, Math.round(share * history.bookingCount));
	return `${count} trong ${history.bookingCount} chuyến gần đây`;
}

function ageOn(dateOfBirth: string, now: Date): number | null {
	const [year, month, day] = dateOfBirth.split("-").map(Number);
	if (!year || !month || !day) return null;
	let age = now.getUTCFullYear() - year;
	const birthdayPassed =
		now.getUTCMonth() + 1 > month || (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);
	if (!birthdayPassed) age -= 1;
	return age >= 0 && age < 130 ? age : null;
}

function tripTypeSection(
	trip: ExplanationTripRow,
	preferences: TripPreferences,
	history: HistoryProfile
): ExplanationSection | null {
	const label = TRIP_TYPE_LABEL[trip.tripType] ?? trip.tripType;
	const nights = trip.tripType === "overnight" && trip.durationNights > 0;
	const tripText = `Chuyến này là chuyến ${label.toLowerCase()}${nights ? `, ${trip.durationNights} đêm` : ""}.`;
	if (preferences.tripTypes.includes(trip.tripType)) {
		return {
			kind: "trip_type",
			tone: "match",
			title: "Đúng loại chuyến bạn chọn",
			quote: {
				source: "trip_preferences",
				field: "Loại chuyến",
				text: preferences.tripTypes.map((type) => TRIP_TYPE_LABEL[type] ?? type).join(", "),
			},
			detail: tripText,
			conclusion: "Vì vậy chuyến đi đúng kiểu trải nghiệm bạn muốn.",
		};
	}
	const count = historyCount(history.tripType[trip.tripType], history);
	if (preferences.tripTypes.length === 0 && count) {
		return {
			kind: "trip_type",
			tone: "match",
			title: "Giống loại chuyến bạn hay đi",
			quote: {
				source: "booking_history",
				field: "Chuyến đã đặt",
				text: `${count} là chuyến ${label.toLowerCase()}`,
			},
			detail: tripText,
			conclusion: "Đây là kiểu chuyến xuất hiện trong lịch sử đặt chỗ của bạn.",
		};
	}
	return null;
}

function fitnessSection(
	trip: ExplanationTripRow,
	health: NonNullable<ExplanationProfile["health"]>
): ExplanationSection {
	const assessment = assessTripHealth(trip, {
		fitnessLevel: health.fitnessLevel,
		activityProfile: health.activityProfile,
		hasMedicalConditions: health.medicalConditions.length > 0,
	});
	return {
		kind: "fitness",
		tone:
			assessment.status === "suitable"
				? "match"
				: assessment.status === "needs_review"
					? "caution"
					: "info",
		title:
			assessment.status === "suitable"
				? "Phù hợp với thông tin đã khai báo"
				: assessment.status === "needs_review"
					? "Cần xác nhận thêm"
					: "Chưa đủ thông tin để đánh giá",
		quote: {
			source: "health_profile",
			field: "Mức thể lực",
			text: FITNESS_LABEL[health.fitnessLevel] ?? health.fitnessLevel,
		},
		detail: difficultyPhrase(trip),
		conclusion: assessment.summary,
	};
}

function demanding(trip: ExplanationTripRow, fitnessLevel: FitnessLevel | null): boolean {
	if (trip.difficulty === "hard" || trip.difficulty === "expert") return true;
	if (isLongRoute(trip.routeLengthMeters, trip.routeDurationMinutes)) return true;
	return fitnessLevel
		? fitnessFit(
				fitnessLevel,
				trip.difficulty,
				trip.routeLengthMeters,
				trip.routeDurationMinutes
			) !== "good"
		: false;
}

function medicalSection(
	trip: ExplanationTripRow,
	health: NonNullable<ExplanationProfile["health"]>
): ExplanationSection | null {
	if (health.medicalConditions.length === 0) return null;
	const medications = health.medicalConditions.flatMap((item) =>
		item.medication ? [item.medication] : []
	);
	const carry =
		medications.length > 0
			? ` Nhớ mang theo ${quoted(medications)} như bạn ghi trong hồ sơ.`
			: " Nhớ mang theo thuốc bạn đang dùng.";
	return {
		kind: "health_note",
		tone: "caution",
		title: "Bệnh nền cần xác nhận thêm",
		quote: {
			source: "health_profile",
			field: "Bệnh nền",
			text: health.medicalConditions.map((item) => item.name).join(", "),
		},
		detail: `${difficultyPhrase(trip)}.${carry}`,
		conclusion:
			"Hệ thống chưa đủ thông tin để đánh giá ảnh hưởng của bệnh nền; cần xác nhận yêu cầu vận động với nhân viên y tế.",
	};
}

function ageSection(
	trip: ExplanationTripRow,
	profile: ExplanationProfile,
	now: Date
): ExplanationSection | null {
	if (!profile.dateOfBirth) return null;
	const age = ageOn(profile.dateOfBirth, now);
	if (age === null || age < SENIOR_AGE || !demanding(trip, profile.health?.fitnessLevel ?? null)) {
		return null;
	}
	return {
		kind: "age",
		tone: "caution",
		title: "Lưu ý theo độ tuổi",
		quote: { source: "personal_profile", field: "Ngày sinh", text: `${age} tuổi` },
		detail: `${difficultyPhrase(trip)}, đòi hỏi sức bền và khớp gối tốt.`,
		conclusion: "Vì vậy hãy kiểm tra sức khỏe trước chuyến và đi với nhịp độ vừa phải.",
	};
}

function interestSections(
	trip: ExplanationTripRow,
	preferences: TripPreferences
): ExplanationSection[] {
	const matches = TRIP_ACTIVITIES.filter(
		(item) => preferences.activities?.includes(item.code) && trip.activities?.includes(item.code)
	);
	return matches.slice(0, 2).map((item) => ({
		kind: "interest",
		tone: "match",
		title: `Có hoạt động bạn chọn: ${item.label}`,
		quote: { source: "trip_preferences", field: "Hoạt động yêu thích", text: item.label },
		detail: `Chủ chuyến đã khai báo hoạt động ${item.label.toLowerCase()} cho chuyến này.`,
		conclusion: null,
	}));
}
function experienceSection(
	trip: ExplanationTripRow,
	profile: ExplanationProfile
): ExplanationSection | null {
	const years = profile.experienceYears;
	if (years == null || trip.difficulty == null) return null;
	const match = declaredExperienceMatches(years, trip.difficulty);
	return {
		kind: "experience",
		tone: match ? "info" : "caution",
		title: "Kinh nghiệm bạn khai báo",
		quote: { source: "personal_profile", field: "Số năm kinh nghiệm", text: `${years} năm` },
		detail: difficultyPhrase(trip),
		conclusion: match
			? "Kinh nghiệm khai báo được dùng để sắp xếp gợi ý; chưa xác nhận khả năng hoàn thành cung đường."
			: "Hãy cân nhắc chuyến dễ hơn hoặc trao đổi với chủ chuyến về khả năng tham gia.",
	};
}

function difficultySection(
	trip: ExplanationTripRow,
	preferences: TripPreferences,
	history: HistoryProfile
): ExplanationSection | null {
	const difficulty: TrekkingRouteDifficulty | null = trip.difficulty;
	if (!difficulty) return null;
	if (preferences.difficulties.includes(difficulty)) {
		return {
			kind: "difficulty",
			tone: "match",
			title: "Đúng độ khó bạn chọn",
			quote: {
				source: "trip_preferences",
				field: "Độ khó",
				text: preferences.difficulties.map((value) => DIFFICULTY_LABEL[value] ?? value).join(", "),
			},
			detail: `${difficultyPhrase(trip)}.`,
			conclusion: "Vì vậy mức thử thách đúng như bạn mong muốn.",
		};
	}
	const count = historyCount(history.difficulty[difficulty], history);
	if (preferences.difficulties.length === 0 && count) {
		return {
			kind: "difficulty",
			tone: "match",
			title: "Độ khó giống các chuyến bạn đã đặt",
			quote: {
				source: "booking_history",
				field: "Chuyến đã đặt",
				text: `${count} có độ khó ${DIFFICULTY_LABEL[difficulty] ?? difficulty}`,
			},
			detail: `${difficultyPhrase(trip)}.`,
			conclusion:
				"Đây là độ khó xuất hiện trong các chuyến bạn đã đặt; chưa chứng minh bạn đã hoàn thành cung đường.",
		};
	}
	return null;
}

function regionSection(
	trip: ExplanationTripRow,
	preferences: TripPreferences,
	history: HistoryProfile
): ExplanationSection | null {
	const label = regionLabel(trip.region);
	if (!trip.region || !label) return null;
	if (preferences.regions.includes(trip.region)) {
		return {
			kind: "region",
			tone: "match",
			title: "Ở khu vực bạn quan tâm",
			quote: {
				source: "trip_preferences",
				field: "Khu vực",
				text: preferences.regions.map((code) => regionLabel(code) ?? code).join(", "),
			},
			detail: `Điểm tập trung của chuyến ở ${label}.`,
			conclusion: "Vì vậy bạn được đi đúng nơi mình muốn khám phá.",
		};
	}
	const count = historyCount(history.region[trip.region], history);
	if (preferences.regions.length === 0 && count) {
		return {
			kind: "region",
			tone: "match",
			title: "Khu vực bạn hay đến",
			quote: { source: "booking_history", field: "Chuyến đã đặt", text: `${count} ở ${label}` },
			detail: `Điểm tập trung của chuyến ở ${label}.`,
			conclusion: "Khu vực này xuất hiện trong lịch sử đặt chỗ của bạn.",
		};
	}
	return null;
}

function priceSection(
	trip: ExplanationTripRow,
	preferences: TripPreferences,
	history: HistoryProfile
): ExplanationSection {
	const price = trip.pricePerPerson;
	const { minPrice, maxPrice } = preferences;
	if (minPrice !== null || maxPrice !== null) {
		const range =
			minPrice !== null && maxPrice !== null
				? `${vnd(minPrice)} – ${vnd(maxPrice)}`
				: minPrice !== null
					? `Từ ${vnd(minPrice)}`
					: `Đến ${vnd(maxPrice as number)}`;
		const inside =
			(minPrice === null || price >= minPrice) && (maxPrice === null || price <= maxPrice);
		return {
			kind: "price",
			tone: inside ? "match" : "info",
			title: inside ? "Nằm trong ngân sách bạn chọn" : "Giá ngoài mức bạn chọn",
			quote: { source: "trip_preferences", field: "Mức giá", text: range },
			detail: `Giá chuyến là ${vnd(price)}/người.`,
			conclusion: inside
				? "Vì vậy chi phí đúng với ngân sách bạn đã đặt ra."
				: "Chuyến vẫn được gợi ý vì khớp các tiêu chí khác; hãy cân nhắc chi phí trước khi đặt.",
		};
	}
	const band = priceBand(price);
	const count = historyCount(history.priceBand[band], history);
	if (count) {
		return {
			kind: "price",
			tone: "match",
			title: "Mức giá giống các chuyến bạn đã đặt",
			quote: {
				source: "booking_history",
				field: "Chuyến đã đặt",
				text: `${count} có giá ${PRICE_BAND_LABEL[band]}`,
			},
			detail: `Giá chuyến là ${vnd(price)}/người.`,
			conclusion: "Vì vậy chi phí nằm trong mức bạn thường chi cho một chuyến đi.",
		};
	}
	return {
		kind: "price",
		tone: "info",
		title: "Giá chuyến",
		quote: null,
		detail: `${vnd(price)}/người.`,
		conclusion: null,
	};
}

function routeSection(trip: ExplanationTripRow): ExplanationSection | null {
	const effort = effortFacts(trip);
	if (!effort) return null;
	return {
		kind: "route",
		tone: "info",
		title: "Cung đường",
		quote: null,
		detail: `${effort.charAt(0).toUpperCase()}${effort.slice(1)}.`,
		conclusion: null,
	};
}

function timingSection(trip: ExplanationTripRow, now: Date): ExplanationSection {
	const days = Math.max(0, Math.ceil((trip.startsAt.getTime() - now.getTime()) / DAY_MS));
	const when = days <= 1 ? "trong vòng 1 ngày tới" : `sau ${days} ngày`;
	const seats =
		trip.capacityMax === null ? "" : ` Còn ${Math.max(0, trip.capacityMax - trip.seatsTaken)} chỗ.`;
	return {
		kind: "timing",
		tone: "info",
		title: "Lịch khởi hành",
		quote: null,
		detail: `Khởi hành ${date(trip.startsAt)} (${when}).${seats} Hạn đặt chỗ: ${date(trip.bookingDeadline)}.`,
		conclusion: null,
	};
}

function availabilitySection(trip: ExplanationTripRow, now: Date): ExplanationSection | null {
	if (trip.heldByCamper) {
		return {
			kind: "availability",
			tone: "info",
			title: "Bạn đã giữ chỗ cho chuyến này",
			quote: null,
			detail: "Xem đơn đặt chỗ của bạn trong mục Chuyến đi của tôi.",
			conclusion: null,
		};
	}
	if (evaluateTripBookingEligibility(trip, 1, now) !== null) {
		return {
			kind: "availability",
			tone: "caution",
			title: "Chuyến này hiện không còn nhận đặt chỗ",
			quote: null,
			detail:
				"Chuyến đã hết chỗ, quá hạn đặt hoặc tạm dừng sau khi bạn xem gợi ý. Hãy mở lại gợi ý để xem chuyến khác.",
			conclusion: null,
		};
	}
	return null;
}

function joinVietnamese(items: string[]): string {
	if (items.length <= 1) return items.join("");
	return `${items.slice(0, -1).join(", ")} và ${items.at(-1)}`;
}

function summarize(sections: ExplanationSection[]): string {
	const labels = (tone: ExplanationTone) => [
		...new Set(
			sections
				.filter((section) => section.tone === tone)
				.flatMap((section) => SUMMARY_LABEL[section.kind] ?? [])
		),
	];
	const matches = labels("match");
	const cautions = labels("caution");
	const parts = [
		matches.length > 0
			? `Vì vậy chuyến này phù hợp với bạn về ${joinVietnamese(matches)}, đúng với những gì bạn đã cung cấp.`
			: "Chuyến này được gợi ý vì đang mở đặt chỗ và gần với hồ sơ của bạn nhất.",
	];
	if (cautions.length > 0) {
		parts.push(`Trước khi đặt, hãy lưu ý về ${joinVietnamese(cautions)}.`);
	}
	return parts.join(" ");
}

export function buildExplanation(input: ExplanationInput): Explanation {
	const { trip, preferences, history, profile, now } = input;
	const health = profile.health;
	const fitness = health ? fitnessSection(trip, health) : null;
	const sections = [
		availabilitySection(trip, now),
		fitness,
		tripTypeSection(trip, preferences, history),
		...interestSections(trip, preferences),
		experienceSection(trip, profile),
		difficultySection(trip, preferences, history),
		regionSection(trip, preferences, history),
		priceSection(trip, preferences, history),
		health ? medicalSection(trip, health) : null,
		ageSection(trip, profile, now),
		// The fitness point already states the Route figures when it is shown.
		fitness ? null : routeSection(trip),
		timingSection(trip, now),
	].filter((section): section is ExplanationSection => section !== null);
	return { sections, summary: summarize(sections) };
}
