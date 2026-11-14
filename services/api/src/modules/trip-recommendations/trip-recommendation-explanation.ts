import { evaluateTripBookingEligibility } from "../bookings/trip-booking-eligibility";
import type { FitnessLevel } from "../profiles/entities/health-profile.entity";
import type { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";
import {
	type FitnessFit,
	HISTORY_REASON_MIN_SHARE,
	type HistoryProfile,
	type TripPreferences,
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
const SEVERITY_LABEL: Record<string, string> = {
	LOW: "nhẹ",
	MEDIUM: "trung bình",
	HIGH: "nặng",
	CRITICAL: "rất nặng",
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
	allergy: "dị ứng",
	diet: "chế độ ăn",
	age: "độ tuổi",
	availability: "tình trạng đặt chỗ",
};

/** Activities a Camper may mention in their bio, and the words a Trip uses for them. */
const INTERESTS: Array<{ label: string; words: string[]; ignore?: string[] }> = [
	{ label: "săn mây", words: ["săn mây", "biển mây", "mây"] },
	{ label: "ngắm bình minh, hoàng hôn", words: ["bình minh", "hoàng hôn", "mặt trời mọc"] },
	// "biển mây" is a sea of clouds, not the sea.
	{ label: "biển", words: ["biển", "bãi tắm", "rạn"], ignore: ["biển mây"] },
	{ label: "rừng", words: ["rừng", "nguyên sinh"] },
	{ label: "thác, suối", words: ["thác", "suối"] },
	{ label: "cắm trại", words: ["cắm trại", "lều", "lửa trại"] },
	{ label: "leo núi, chinh phục đỉnh", words: ["leo núi", "chinh phục", "đỉnh"] },
	{ label: "đèo", words: ["đèo"] },
	{ label: "ngắm sao", words: ["ngắm sao", "bầu trời đêm"] },
	{ label: "chụp ảnh", words: ["chụp ảnh", "nhiếp ảnh", "check-in"] },
	{ label: "khám phá thiên nhiên hoang sơ", words: ["hoang sơ", "khám phá"] },
];
const MAX_INTERESTS = 2;
const MAX_QUOTE_LENGTH = 140;
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

/** The sentence of the bio that mentions `word`, shortened around it. */
function bioExcerpt(bio: string, word: string): string {
	const sentence =
		bio
			.split(/[.!?\n]+/)
			.map((part) => part.trim())
			.find((part) => part.toLowerCase().includes(word)) ?? bio.trim();
	if (sentence.length <= MAX_QUOTE_LENGTH) return sentence;
	const at = sentence.toLowerCase().indexOf(word);
	const start = Math.max(0, at - 50);
	const end = start + MAX_QUOTE_LENGTH;
	return `${start > 0 ? "…" : ""}${sentence.slice(start, end).trim()}${end < sentence.length ? "…" : ""}`;
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
				field: "Chuyến đã đi",
				text: `${count} là chuyến ${label.toLowerCase()}`,
			},
			detail: tripText,
			conclusion: "Vì vậy đây là kiểu chuyến bạn đã quen và thường chọn.",
		};
	}
	return null;
}

const FIT_TEXT: Record<FitnessFit, { tone: ExplanationTone; title: string; conclusion: string }> = {
	good: {
		tone: "match",
		title: "Vừa sức với thể lực của bạn",
		conclusion: "Vì vậy bạn có thể đi trọn cung đường mà không bị quá sức.",
	},
	stretch: {
		tone: "caution",
		title: "Hơi thử thách so với thể lực hiện tại",
		conclusion:
			"Vì vậy chuyến vẫn phù hợp nếu bạn muốn nâng sức bền, nhưng hãy tập luyện, ngủ đủ và chuẩn bị kỹ trước ngày đi.",
	},
	too_hard: {
		tone: "caution",
		title: "Vượt khá xa thể lực hiện tại",
		conclusion:
			"Vì vậy chuyến được xếp sau các chuyến vừa sức hơn; hãy cân nhắc kỹ hoặc trao đổi với chủ chuyến trước khi đặt.",
	},
};

function fitnessSection(
	trip: ExplanationTripRow,
	fitnessLevel: FitnessLevel
): ExplanationSection | null {
	const fit = fitnessFit(
		fitnessLevel,
		trip.difficulty,
		trip.routeLengthMeters,
		trip.routeDurationMinutes
	);
	if (!fit) return null;
	const long = isLongRoute(trip.routeLengthMeters, trip.routeDurationMinutes)
		? " Cung đường dài nên cần sức bền hơn mức độ khó ghi trên chuyến."
		: "";
	const compare =
		fit === "good"
			? "nằm trong mức bạn đã quen"
			: fit === "stretch"
				? "cao hơn một bậc so với mức bạn đã quen"
				: "cao hơn nhiều so với mức bạn đã quen";
	const text = FIT_TEXT[fit];
	return {
		kind: "fitness",
		tone: text.tone,
		title: text.title,
		quote: {
			source: "health_profile",
			field: "Mức thể lực",
			text: FITNESS_LABEL[fitnessLevel] ?? fitnessLevel,
		},
		detail: `${difficultyPhrase(trip)}, ${compare}.${long}`,
		conclusion: text.conclusion,
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
	const hard = demanding(trip, health.fitnessLevel);
	return {
		kind: "health_note",
		tone: hard ? "caution" : "info",
		title: hard ? "Cần lưu ý với bệnh nền của bạn" : "Phù hợp với bệnh nền đã ghi",
		quote: {
			source: "health_profile",
			field: "Bệnh nền",
			text: health.medicalConditions.map((item) => item.name).join(", "),
		},
		detail: `${difficultyPhrase(trip)}.${carry}`,
		conclusion: hard
			? "Vì vậy hãy hỏi ý kiến bác sĩ và báo trước cho chủ chuyến để được hỗ trợ khi cần."
			: "Vì vậy mức gắng sức của chuyến không cao, bạn vẫn có thể tham gia nếu đã kiểm soát tốt bệnh.",
	};
}

function allergySection(
	trip: ExplanationTripRow,
	health: NonNullable<ExplanationProfile["health"]>
): ExplanationSection | null {
	if (health.allergies.length === 0) return null;
	const serious = health.allergies.some(
		(item) => item.severity === "HIGH" || item.severity === "CRITICAL"
	);
	return {
		kind: "allergy",
		tone: serious ? "caution" : "info",
		title: "Lưu ý dị ứng của bạn",
		quote: {
			source: "health_profile",
			field: "Dị ứng",
			text: health.allergies
				.map((item) =>
					item.severity && SEVERITY_LABEL[item.severity]
						? `${item.name} (mức ${SEVERITY_LABEL[item.severity]})`
						: item.name
				)
				.join(", "),
		},
		detail:
			trip.tripType === "overnight"
				? "Chuyến qua đêm ngoài trời, có ăn uống và ngủ lại giữa thiên nhiên."
				: "Chuyến đi ngoài trời, tiếp xúc nhiều với cây cỏ và côn trùng.",
		conclusion:
			"Vì vậy hãy mang theo thuốc dị ứng và báo trước cho chủ chuyến để họ chuẩn bị phù hợp.",
	};
}

function dietSection(
	trip: ExplanationTripRow,
	health: NonNullable<ExplanationProfile["health"]>
): ExplanationSection | null {
	if (!health.dietaryRestrictions) return null;
	return {
		kind: "diet",
		tone: "info",
		title: "Chế độ ăn của bạn",
		quote: { source: "health_profile", field: "Chế độ ăn", text: health.dietaryRestrictions },
		detail:
			trip.tripType === "overnight"
				? `Chuyến kéo dài ${trip.durationNights} đêm nên có các bữa ăn trong hành trình.`
				: "Chuyến trong ngày có thể có bữa ăn hoặc đồ ăn nhẹ dọc đường.",
		conclusion: "Vì vậy hãy báo trước cho chủ chuyến để bữa ăn được chuẩn bị đúng chế độ của bạn.",
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

function interestSections(trip: ExplanationTripRow, bio: string | null): ExplanationSection[] {
	if (!bio) return [];
	const lowerBio = bio.toLowerCase();
	const tripText = `${trip.title} ${trip.description ?? ""}`.toLowerCase();
	const sections: ExplanationSection[] = [];
	const without = (text: string, ignore: string[] = []) =>
		ignore.reduce((result, phrase) => result.replaceAll(phrase, " "), text);
	for (const interest of INTERESTS) {
		if (sections.length >= MAX_INTERESTS) break;
		const bioText = without(lowerBio, interest.ignore);
		const offered = without(tripText, interest.ignore);
		const inBio = interest.words.find((word) => bioText.includes(word));
		if (!inBio) continue;
		if (!interest.words.some((word) => offered.includes(word))) continue;
		sections.push({
			kind: "interest",
			tone: "match",
			title: `Có hoạt động bạn yêu thích: ${interest.label}`,
			quote: {
				source: "personal_profile",
				field: "Giới thiệu bản thân",
				text: bioExcerpt(bio, inBio),
			},
			detail: `Chuyến “${trip.title}” có ${interest.label} trong lịch trình.`,
			conclusion: "Vì vậy chuyến đi đúng với điều bạn đã chia sẻ là mình thích.",
		});
	}
	return sections;
}

/** Place words a Camper may write in their experience, for the Trip's area. */
const REGION_WORDS: Record<string, string[]> = {
	son_tra: ["sơn trà", "bàn cờ", "linh ứng", "bãi bụt", "ghềnh bàng"],
	hai_van_lien_chieu: ["hải vân", "nam ô", "liên chiểu", "hòa khánh"],
	ba_na_hoa_vang: ["bà nà", "hòa vang", "hòa phú thành", "hòa bắc", "hòa ninh"],
	ngu_hanh_son: ["ngũ hành sơn", "non nước", "mỹ khê"],
	city_center: ["hải châu", "thanh khê", "cẩm lệ"],
};
/** Short title words that say nothing about the place. */
const TITLE_STOP_WORDS = new Set([
	"khám",
	"phá",
	"chuyến",
	"đỉnh",
	"săn",
	"mây",
	"ngắm",
	"bình",
	"minh",
	"trekking",
	"cắm",
	"trại",
	"dạo",
	"bộ",
	"chinh",
	"phục",
	"rừng",
	"qua",
	"đêm",
	"trong",
	"ngày",
	"bán",
	"đảo",
]);
const EXPERIENCED_YEARS = 2;

/** A place from the Trip (its area or a distinctive pair of title words) found in the text. */
function mentionedPlace(trip: ExplanationTripRow, text: string): string | null {
	const lower = text.toLowerCase();
	const areaWord = (trip.region ? (REGION_WORDS[trip.region] ?? []) : []).find((word) =>
		lower.includes(word)
	);
	if (areaWord) return areaWord;
	const words = trip.title
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word.length > 1 && !TITLE_STOP_WORDS.has(word));
	for (let i = 0; i + 1 < words.length; i++) {
		const pair = `${words[i]} ${words[i + 1]}`;
		if (lower.includes(pair)) return pair;
	}
	return null;
}

function experienceSection(
	trip: ExplanationTripRow,
	profile: ExplanationProfile
): ExplanationSection | null {
	const { experienceYears: years, experienceDetails: details } = profile;
	const place = details ? mentionedPlace(trip, details) : null;
	if (details && place) {
		const area = regionLabel(trip.region);
		return {
			kind: "experience",
			tone: "match",
			title: "Bạn đã từng đi khu vực này",
			quote: {
				source: "personal_profile",
				field: "Kinh nghiệm trekking",
				text: bioExcerpt(details, place),
			},
			detail: area
				? `Chuyến “${trip.title}” đi ở ${area}, nơi bạn đã ghi là từng trekking.`
				: `Chuyến “${trip.title}” đi qua nơi bạn đã ghi là từng trekking.`,
			conclusion: "Vì vậy bạn đã quen địa hình và nhịp đi của khu vực này.",
		};
	}
	if (years === null || years <= 0) {
		if (years === 0 && (trip.difficulty === "hard" || trip.difficulty === "expert")) {
			return {
				kind: "experience",
				tone: "caution",
				title: "Chuyến khó khi bạn mới bắt đầu",
				quote: { source: "personal_profile", field: "Số năm kinh nghiệm", text: "0 năm" },
				detail: `${difficultyPhrase(trip)}.`,
				conclusion:
					"Vì vậy hãy cân nhắc bắt đầu bằng một chuyến dễ hơn, hoặc trao đổi với chủ chuyến về hỗ trợ cho người mới.",
			};
		}
		return null;
	}
	const demandingTrip =
		trip.tripType === "overnight" || trip.difficulty === "hard" || trip.difficulty === "expert";
	const ready = years >= EXPERIENCED_YEARS || !demandingTrip;
	const kindOfTrip =
		trip.tripType === "overnight"
			? `chuyến qua đêm${trip.difficulty ? `, độ khó ${DIFFICULTY_LABEL[trip.difficulty] ?? trip.difficulty}` : ""}`
			: `chuyến trong ngày${trip.difficulty ? `, độ khó ${DIFFICULTY_LABEL[trip.difficulty] ?? trip.difficulty}` : ""}`;
	return {
		kind: "experience",
		tone: ready ? "match" : "caution",
		title: ready ? "Đủ kinh nghiệm cho chuyến này" : "Kinh nghiệm còn ít so với chuyến",
		quote: { source: "personal_profile", field: "Số năm kinh nghiệm", text: `${years} năm` },
		detail: `Đây là ${kindOfTrip}.`,
		conclusion: ready
			? "Vì vậy bạn đã có đủ trải nghiệm để tự tin tham gia."
			: "Vì vậy hãy chuẩn bị kỹ đồ dùng qua đêm và đi cùng người có kinh nghiệm.",
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
			title: "Độ khó giống các chuyến bạn đã đi",
			quote: {
				source: "booking_history",
				field: "Chuyến đã đi",
				text: `${count} có độ khó ${DIFFICULTY_LABEL[difficulty] ?? difficulty}`,
			},
			detail: `${difficultyPhrase(trip)}.`,
			conclusion: "Vì vậy đây là mức thử thách bạn đã từng vượt qua.",
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
			quote: { source: "booking_history", field: "Chuyến đã đi", text: `${count} ở ${label}` },
			detail: `Điểm tập trung của chuyến ở ${label}.`,
			conclusion: "Vì vậy bạn đã quen đường đi và địa hình khu vực này.",
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
	const fitness = health ? fitnessSection(trip, health.fitnessLevel) : null;
	const sections = [
		availabilitySection(trip, now),
		fitness,
		tripTypeSection(trip, preferences, history),
		...interestSections(trip, profile.bio),
		experienceSection(trip, profile),
		difficultySection(trip, preferences, history),
		regionSection(trip, preferences, history),
		priceSection(trip, preferences, history),
		health ? medicalSection(trip, health) : null,
		health ? allergySection(trip, health) : null,
		health ? dietSection(trip, health) : null,
		ageSection(trip, profile, now),
		// The fitness point already states the Route figures when it is shown.
		fitness ? null : routeSection(trip),
		timingSection(trip, now),
	].filter((section): section is ExplanationSection => section !== null);
	return { sections, summary: summarize(sections) };
}
