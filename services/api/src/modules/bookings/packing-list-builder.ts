import type { AllergyItem, MedicalConditionItem } from "../profiles/entities/health-profile.entity";
import { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";
import {
	RiskLevel,
	type WeatherCriteriaScoresDetail,
} from "../weather/entities/weather-risk-assessment.entity";
import type { PackingListItemResponseDto } from "./dto/packing-list-item-response.dto";
import { PackingListItemCategory } from "./packing-list-item-category.enum";

export interface RentedEquipmentInput {
	name: string;
	category: string;
	quantity: number;
}

export interface HealthProfileInput {
	isConsentGranted: boolean;
	allergies: AllergyItem[];
	medicalConditions: MedicalConditionItem[];
	dietaryRestrictions: string | null;
}

export interface PackingListContext {
	durationNights: number;
	tripType: "day_trip" | "overnight";
	difficulty: TrekkingRouteDifficulty | null;
	memberCount: number;
	weatherRiskLevel: RiskLevel | null;
	weatherCriteria: WeatherCriteriaScoresDetail | null;
}

function isRentedMatching(rentedEquipment: RentedEquipmentInput[], pattern: RegExp): boolean {
	return rentedEquipment.some((item) => pattern.test(item.category) || pattern.test(item.name));
}

function item(
	id: string,
	name: string,
	category: PackingListItemCategory,
	required: boolean,
	reason: string,
	alreadyCovered = false
): PackingListItemResponseDto {
	return { id, name, category, required, reason, alreadyCovered };
}

/**
 * CTMS-042-T01. Deterministic, rule-based packing list -- no AI/LLM call
 * (nothing in PB V3.1/BR-137/138 or this codebase's other providers, e.g.
 * `weather-advice`'s own explicit LLM integration, suggests this story
 * calls one). Same authoritative inputs always produce the same ordered
 * output (AC "stable, explainable result").
 */
export function buildPackingListItems(
	context: PackingListContext,
	rentedEquipment: RentedEquipmentInput[],
	health: HealthProfileInput | null
): PackingListItemResponseDto[] {
	const items: PackingListItemResponseDto[] = [];
	const { ESSENTIAL, CLOTHING, GEAR, SAFETY, HEALTH } = PackingListItemCategory;

	// Always required, regardless of Trip context (BR-137: duration/difficulty/member/equipment context).
	items.push(
		item("id-documents", "Giấy tờ tùy thân", ESSENTIAL, true, "Luôn cần cho mọi chuyến đi"),
		item(
			"drinking-water",
			"Nước uống",
			ESSENTIAL,
			true,
			`Đủ nước uống cho ${context.memberCount} người trong chuyến đi`
		),
		item("headlamp", "Đèn pin / đèn đội đầu", GEAR, true, "Di chuyển an toàn khi trời tối"),
		item("first-aid-kit", "Túi sơ cứu cơ bản", SAFETY, true, "Sơ cứu cơ bản cho mọi chuyến đi")
	);

	if (context.tripType === "overnight") {
		const nights = context.durationNights;
		const sleepingBagCovered = isRentedMatching(rentedEquipment, /sleep|ngủ/i);
		const tentCovered = isRentedMatching(rentedEquipment, /shelter|lều|tent/i);
		items.push(
			item(
				"sleeping-bag",
				"Túi ngủ",
				GEAR,
				!sleepingBagCovered,
				`Chuyến đi qua đêm ${nights} đêm`,
				sleepingBagCovered
			),
			item("tent", "Lều trại", GEAR, !tentCovered, `Chuyến đi qua đêm ${nights} đêm`, tentCovered),
			item(
				"warm-night-clothing",
				"Quần áo giữ ấm ban đêm",
				CLOTHING,
				true,
				"Nhiệt độ ban đêm có thể xuống thấp"
			)
		);
	}

	if (context.difficulty) {
		const isModerateOrHarder = [
			TrekkingRouteDifficulty.MODERATE,
			TrekkingRouteDifficulty.HARD,
			TrekkingRouteDifficulty.EXPERT,
		].includes(context.difficulty);
		const isHardOrExpert = [TrekkingRouteDifficulty.HARD, TrekkingRouteDifficulty.EXPERT].includes(
			context.difficulty
		);
		if (isModerateOrHarder) {
			items.push(
				item(
					"trekking-poles",
					"Gậy trekking",
					GEAR,
					false,
					`Độ khó tuyến đường: ${context.difficulty}`
				)
			);
		}
		if (isHardOrExpert) {
			items.push(
				item(
					"trekking-boots",
					"Giày trekking chuyên dụng",
					CLOTHING,
					true,
					`Độ khó tuyến đường: ${context.difficulty}, cần giày bám địa hình tốt`
				)
			);
		}
	}

	if (context.weatherCriteria) {
		const { rainfall, wind, visibility, thunderstorm } = context.weatherCriteria;
		if (rainfall.level !== RiskLevel.GREEN) {
			items.push(
				item(
					"rain-gear",
					"Áo mưa / áo khoác chống nước",
					CLOTHING,
					true,
					`Dự báo lượng mưa ở mức ${rainfall.level}`
				)
			);
		}
		if (wind.level !== RiskLevel.GREEN) {
			items.push(
				item("windbreaker", "Áo gió chắn gió", CLOTHING, true, `Dự báo gió ở mức ${wind.level}`)
			);
		}
		if (visibility.level !== RiskLevel.GREEN) {
			items.push(
				item(
					"extra-light-source",
					"Đèn pin dự phòng / pin sạc",
					SAFETY,
					false,
					`Tầm nhìn dự báo ở mức ${visibility.level}`
				)
			);
		}
		if (thunderstorm.value === true) {
			items.push(
				item(
					"lightning-safety-note",
					"Lưu ý an toàn dông sét: tránh nơi trống trải, hạn chế vật kim loại cồng kềnh",
					SAFETY,
					false,
					"Dự báo có khả năng xảy ra dông sét"
				)
			);
		}
	}

	if (health?.isConsentGranted) {
		if (health.allergies.length > 0) {
			items.push(
				item(
					"allergy-medication",
					"Thuốc dị ứng cá nhân",
					HEALTH,
					true,
					`Có ${health.allergies.length} dị ứng đã ghi nhận trong hồ sơ sức khỏe`
				)
			);
		}
		if (health.medicalConditions.length > 0) {
			items.push(
				item(
					"medical-condition-medication",
					"Thuốc điều trị bệnh nền",
					HEALTH,
					true,
					`Có ${health.medicalConditions.length} bệnh nền đã ghi nhận trong hồ sơ sức khỏe`
				)
			);
		}
		if (health.dietaryRestrictions?.trim()) {
			items.push(
				item(
					"dietary-note",
					"Thực phẩm phù hợp chế độ ăn cá nhân",
					HEALTH,
					false,
					`Hồ sơ sức khỏe ghi nhận hạn chế ăn uống: ${health.dietaryRestrictions.trim()}`
				)
			);
		}
	}

	for (const rented of rentedEquipment) {
		items.push(
			item(
				`rented-${rented.name.toLowerCase().replace(/\s+/g, "-")}`,
				`${rented.name} (đã thuê x${rented.quantity})`,
				GEAR,
				false,
				"Đã thuê qua CTMS, không cần mang riêng",
				true
			)
		);
	}

	return items;
}
