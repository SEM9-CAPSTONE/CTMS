import { FitnessLevel } from "../profiles/entities/health-profile.entity";
import {
	TrekkingRouteDifficulty,
	TrekkingRouteStatus,
} from "../trekking-routes/entities/trekking-route.entity";
import { TripStatus, TripType } from "../trips/entities/trip.entity";
import { buildExplanation } from "./trip-recommendation-explanation";
import { EMPTY_PREFERENCES, summarizeHistory } from "./trip-recommendation.policy";
import type { ExplanationProfile, ExplanationTripRow } from "./trip-recommendations.repository";

const now = new Date("2026-11-14T03:00:00.000Z");
const DAY = 86_400_000;
const TRIP_ID = "6b1f2c4e-8d3a-4f7b-9c2e-1a5d7e9f0b3c";

const trip = (overrides: Partial<ExplanationTripRow> = {}): ExplanationTripRow => ({
	tripId: TRIP_ID,
	title: "Săn mây đỉnh Bà Nà",
	description: "Cắm trại qua đêm trên đỉnh, đón bình minh và ngắm biển mây lúc sáng sớm.",
	routeId: "7c2d3e4f-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
	status: TripStatus.PUBLISHED,
	routeStatus: TrekkingRouteStatus.ACTIVE,
	tripType: TripType.OVERNIGHT,
	durationNights: 1,
	difficulty: TrekkingRouteDifficulty.HARD,
	region: "ba_na_hoa_vang",
	pricePerPerson: 1_850_000,
	bookingDeadline: new Date(now.getTime() + 4 * DAY),
	startsAt: new Date(now.getTime() + 6 * DAY),
	endsAt: new Date(now.getTime() + 7 * DAY),
	capacityMax: 12,
	seatsTaken: 5,
	weatherPausedAt: null,
	publishedAt: new Date("2026-10-01T00:00:00.000Z"),
	routeLengthMeters: 8_500,
	routeDurationMinutes: 270,
	heldByCamper: false,
	...overrides,
});

const preferences = {
	...EMPTY_PREFERENCES,
	tripTypes: [TripType.OVERNIGHT],
	regions: ["ba_na_hoa_vang" as const],
	minPrice: 500_000,
	maxPrice: 2_500_000,
};

const NO_PROFILE: ExplanationProfile = {
	bio: null,
	dateOfBirth: null,
	experienceYears: null,
	experienceDetails: null,
	health: null,
};
const health = (
	overrides: Partial<NonNullable<ExplanationProfile["health"]>> = {}
): NonNullable<ExplanationProfile["health"]> => ({
	fitnessLevel: FitnessLevel.ADVANCED,
	allergies: [],
	medicalConditions: [],
	dietaryRestrictions: null,
	...overrides,
});

const build = (
	profile: ExplanationProfile,
	overrides: { trip?: Partial<ExplanationTripRow>; preferences?: typeof preferences } = {}
) =>
	buildExplanation({
		trip: trip(overrides.trip),
		preferences: overrides.preferences ?? preferences,
		history: summarizeHistory([]),
		profile,
		now,
	});
const byKind = (result: ReturnType<typeof buildExplanation>) =>
	Object.fromEntries(result.sections.map((section) => [section.kind, section]));

describe("buildExplanation", () => {
	it("quotes the chosen fitness level, compares it with the Route and concludes", () => {
		const sections = byKind(build({ ...NO_PROFILE, health: health() }));
		expect(sections.fitness).toEqual({
			kind: "fitness",
			tone: "match",
			title: "Vừa sức với thể lực của bạn",
			quote: {
				source: "health_profile",
				field: "Mức thể lực",
				text: "Nâng cao (Trekking đèo dốc thường xuyên)",
			},
			detail:
				"Cung đường có độ khó Khó, dài 8,5 km, đi bộ khoảng 4 giờ 30 phút, nằm trong mức bạn đã quen.",
			conclusion: "Vì vậy bạn có thể đi trọn cung đường mà không bị quá sức.",
		});
		// The Route figures live in the fitness point, not repeated.
		expect(sections.route).toBeUndefined();
	});

	it("quotes trip preferences with the exact options and price range", () => {
		const sections = byKind(build(NO_PROFILE));
		expect(sections.trip_type.quote).toEqual({
			source: "trip_preferences",
			field: "Loại chuyến",
			text: "Qua đêm",
		});
		expect(sections.region.quote?.text).toBe("Bà Nà – Hòa Vang");
		expect(sections.price).toMatchObject({
			tone: "match",
			quote: { field: "Mức giá", text: "500.000 đ – 2.500.000 đ" },
			detail: "Giá chuyến là 1.850.000 đ/người.",
			conclusion: "Vì vậy chi phí đúng với ngân sách bạn đã đặt ra.",
		});
		expect(sections.route.detail).toBe("Dài 8,5 km, đi bộ khoảng 4 giờ 30 phút.");
	});

	it("quotes the Camper's bio when the Trip offers what they wrote they like", () => {
		const result = build({
			...NO_PROFILE,
			bio: "Mình là dân văn phòng ở Hải Châu. Cuối tuần mình mê săn mây và chụp ảnh bình minh trên núi!",
		});
		const interests = result.sections.filter((section) => section.kind === "interest");
		expect(interests).toHaveLength(2);
		expect(interests[0]).toMatchObject({
			title: "Có hoạt động bạn yêu thích: săn mây",
			quote: {
				source: "personal_profile",
				field: "Giới thiệu bản thân",
				text: "Cuối tuần mình mê săn mây và chụp ảnh bình minh trên núi",
			},
			detail: "Chuyến “Săn mây đỉnh Bà Nà” có săn mây trong lịch trình.",
		});
		expect(interests[1].title).toBe("Có hoạt động bạn yêu thích: ngắm bình minh, hoàng hôn");
	});

	it("ignores bio interests the Trip does not offer", () => {
		const result = build({ ...NO_PROFILE, bio: "Mình thích lặn biển và ngắm san hô." });
		expect(result.sections.some((section) => section.kind === "interest")).toBe(false);
	});

	it("quotes medical conditions, medication, allergies and diet with fitting advice", () => {
		const sections = byKind(
			build({
				...NO_PROFILE,
				health: health({
					fitnessLevel: FitnessLevel.INTERMEDIATE,
					medicalConditions: [{ name: "Hen suyễn", medication: "Ventolin" }],
					allergies: [{ name: "Phấn hoa", severity: "HIGH" }],
					dietaryRestrictions: "Ăn chay",
				}),
			})
		);
		expect(sections.fitness).toMatchObject({
			tone: "caution",
			title: "Hơi thử thách so với thể lực hiện tại",
		});
		expect(sections.health_note).toMatchObject({
			tone: "caution",
			quote: { field: "Bệnh nền", text: "Hen suyễn" },
		});
		expect(sections.health_note.detail).toContain("Nhớ mang theo “Ventolin”");
		expect(sections.allergy).toMatchObject({
			tone: "caution",
			quote: { field: "Dị ứng", text: "Phấn hoa (mức nặng)" },
		});
		expect(sections.diet).toMatchObject({ quote: { field: "Chế độ ăn", text: "Ăn chay" } });
	});

	it("calls an easy Trip suitable for a recorded condition", () => {
		const sections = byKind(
			build(
				{
					...NO_PROFILE,
					health: health({
						fitnessLevel: FitnessLevel.BEGINNER,
						medicalConditions: [{ name: "Cao huyết áp", medication: null }],
					}),
				},
				{ trip: { difficulty: TrekkingRouteDifficulty.EASY, routeLengthMeters: 4_000 } }
			)
		);
		expect(sections.fitness.tone).toBe("match");
		expect(sections.health_note).toMatchObject({
			tone: "info",
			title: "Phù hợp với bệnh nền đã ghi",
		});
	});

	it("adds an age caution only for demanding Trips at 60 or older", () => {
		const senior = { ...NO_PROFILE, dateOfBirth: "1960-03-02" };
		expect(byKind(build(senior)).age).toMatchObject({
			tone: "caution",
			quote: { field: "Ngày sinh", text: "66 tuổi" },
		});
		const easy = build(senior, { trip: { difficulty: TrekkingRouteDifficulty.EASY } });
		expect(easy.sections.some((section) => section.kind === "age")).toBe(false);
		expect(
			build({ ...NO_PROFILE, dateOfBirth: "1995-05-01" }).sections.some(
				(section) => section.kind === "age"
			)
		).toBe(false);
	});

	it("quotes trekking experience that mentions the Trip's area", () => {
		const section = byKind(
			build({
				...NO_PROFILE,
				experienceYears: 3,
				experienceDetails: "Đã trekking Sơn Trà, đèo Hải Vân và cắm trại qua đêm ở Bà Nà hai lần.",
			})
		).experience;
		expect(section).toEqual({
			kind: "experience",
			tone: "match",
			title: "Bạn đã từng đi khu vực này",
			quote: {
				source: "personal_profile",
				field: "Kinh nghiệm trekking",
				text: "Đã trekking Sơn Trà, đèo Hải Vân và cắm trại qua đêm ở Bà Nà hai lần",
			},
			detail: "Chuyến “Săn mây đỉnh Bà Nà” đi ở Bà Nà – Hòa Vang, nơi bạn đã ghi là từng trekking.",
			conclusion: "Vì vậy bạn đã quen địa hình và nhịp đi của khu vực này.",
		});
	});

	it("falls back to the years of experience, and cautions a beginner on a hard Trip", () => {
		const seasoned = byKind(
			build({ ...NO_PROFILE, experienceYears: 4, experienceDetails: "Leo Fansipan năm 2024" })
		).experience;
		expect(seasoned).toMatchObject({
			tone: "match",
			title: "Đủ kinh nghiệm cho chuyến này",
			quote: { field: "Số năm kinh nghiệm", text: "4 năm" },
			detail: "Đây là chuyến qua đêm, độ khó Khó.",
		});
		const fresh = byKind(build({ ...NO_PROFILE, experienceYears: 1 })).experience;
		expect(fresh).toMatchObject({ tone: "caution", title: "Kinh nghiệm còn ít so với chuyến" });
		const none = byKind(build({ ...NO_PROFILE, experienceYears: 0 })).experience;
		expect(none).toMatchObject({ tone: "caution", quote: { text: "0 năm" } });
		const easyDay = build(
			{ ...NO_PROFILE, experienceYears: 0 },
			{ trip: { difficulty: TrekkingRouteDifficulty.EASY, tripType: TripType.DAY_TRIP } }
		);
		expect(easyDay.sections.some((item) => item.kind === "experience")).toBe(false);
	});

	it("concludes over all points and lists the cautions", () => {
		const { summary } = build({
			...NO_PROFILE,
			health: health({ allergies: [{ name: "Phấn hoa", severity: "CRITICAL" }] }),
		});
		expect(summary).toBe(
			"Vì vậy chuyến này phù hợp với bạn về thể lực, loại chuyến, khu vực và mức giá, đúng với những gì bạn đã cung cấp. Trước khi đặt, hãy lưu ý về dị ứng."
		);
	});

	it("uses booking history when no preference was chosen", () => {
		const history = summarizeHistory(
			Array.from({ length: 4 }, (_, i) => ({
				tripType: TripType.OVERNIGHT,
				difficulty: TrekkingRouteDifficulty.HARD,
				region: i < 3 ? ("ba_na_hoa_vang" as const) : ("son_tra" as const),
				pricePerPerson: 1_900_000,
			}))
		);
		const sections = byKind(
			buildExplanation({
				trip: trip(),
				preferences: EMPTY_PREFERENCES,
				history,
				profile: NO_PROFILE,
				now,
			})
		);
		expect(sections.region.quote).toEqual({
			source: "booking_history",
			field: "Chuyến đã đi",
			text: "3 trong 4 chuyến gần đây ở Bà Nà – Hòa Vang",
		});
		expect(sections.trip_type.title).toBe("Giống loại chuyến bạn hay đi");
		expect(sections.fitness).toBeUndefined();
	});

	it("says when the Trip no longer takes bookings or is already held", () => {
		expect(byKind(build(NO_PROFILE, { trip: { seatsTaken: 12 } })).availability.title).toBe(
			"Chuyến này hiện không còn nhận đặt chỗ"
		);
		expect(byKind(build(NO_PROFILE, { trip: { heldByCamper: true } })).availability.title).toBe(
			"Bạn đã giữ chỗ cho chuyến này"
		);
	});

	it("is honest when the price is outside the chosen range, and never shows ids", () => {
		const result = build(NO_PROFILE, { trip: { pricePerPerson: 3_200_000 } });
		expect(byKind(result).price).toMatchObject({ tone: "info", title: "Giá ngoài mức bạn chọn" });
		expect(JSON.stringify(result)).not.toContain(TRIP_ID.slice(0, 8));
	});
});
