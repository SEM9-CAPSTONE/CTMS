import {
	comparePorterLevel,
	computeLevelProgressPercent,
	evaluateLevelCriteria,
	levelDossierHash,
} from "./porter-level-comparison";
import type { LevelDefinition, LevelDossier } from "./porter-levels.types";

const dossier: LevelDossier = {
	porterId: "porter",
	porterName: "Porter",
	profileVersion: 1,
	experienceYears: 2,
	certifications: [" First Aid "],
	skills: ["ĐỊNH HƯỚNG"],
	evidenceVersion: 1,
	verificationStatus: "approved",
	verificationUpdatedAt: null,
	timesLed: 3,
};

const definition: LevelDefinition = {
	name: "Configured",
	minExperienceYears: 2,
	minTimesLed: 3,
	requiredSkills: ["định hướng", "Sơ cứu"],
	requiredCertifications: ["first aid"],
	responsibilities: "Configured by Admin",
};

describe("Porter level comparison (Pure function & criteria evaluation)", () => {
	it("compares inclusive thresholds and normalized text without mutating the dossier", () => {
		const original = JSON.stringify(dossier);
		expect(comparePorterLevel(dossier, definition)).toMatchObject({
			experience: true,
			timesLed: true,
			missingSkills: ["Sơ cứu"],
			missingCertifications: [],
		});
		expect(JSON.stringify(dossier)).toBe(original);
	});

	it("distinguishes unconfigured numeric criteria from failed criteria", () => {
		expect(
			comparePorterLevel(dossier, { ...definition, minExperienceYears: null, minTimesLed: 4 })
		).toMatchObject({ experience: null, timesLed: false });
	});

	it("matches required certifications by type code and respects expiration date in UTC+7", () => {
		const fixedNow = new Date("2026-11-19T15:00:00+07:00");

		const dossierWithCerts: LevelDossier = {
			...dossier,
			certificates: [
				{
					type: "wfa",
					name: "Sơ cấp cứu nơi hoang dã WFA",
					status: "verified",
					expiryDate: "2026-11-19", // Expires TODAY -> still valid!
				},
				{
					type: "rescue",
					name: "Kỹ thuật cứu hộ",
					status: "verified",
					expiryDate: "2026-11-18", // Expired YESTERDAY -> expired!
				},
			],
		};

		const defWithTypes: LevelDefinition = {
			...definition,
			requiredCertifications: ["wfa", "rescue"],
		};

		const result = evaluateLevelCriteria(dossierWithCerts, defWithTypes, fixedNow);

		expect(result.missingCertifications).toEqual([]);
		expect(result.expiredCertifications).toEqual(["rescue"]);
		expect(result.certificateDetails).toEqual([
			expect.objectContaining({ reqCode: "wfa", status: "verified", met: true }),
			expect.objectContaining({ reqCode: "rescue", status: "expired", met: false }),
		]);
	});

	it("captures rejected and pending certificate statuses with rejection reasons", () => {
		const fixedNow = new Date("2026-11-19T15:00:00+07:00");

		const dossierWithRejected: LevelDossier = {
			...dossier,
			certificates: [
				{
					type: "rescue",
					name: "Chứng chỉ cứu hộ",
					status: "rejected",
					rejectionReason: "Ảnh chụp bị mờ 4 góc",
					expiryDate: "2027-01-01",
				},
				{
					type: "guide_card",
					name: "Thẻ HDV",
					status: "pending",
					expiryDate: "2027-01-01",
				},
			],
		};

		const def: LevelDefinition = {
			...definition,
			requiredCertifications: ["rescue", "guide_card"],
		};

		const result = evaluateLevelCriteria(dossierWithRejected, def, fixedNow);

		expect(result.rejectedCertifications).toEqual([
			{ type: "rescue", name: "Chứng chỉ cứu hộ", rejectionReason: "Ảnh chụp bị mờ 4 góc" },
		]);
		expect(result.pendingCertifications).toEqual([{ type: "guide_card", name: "Thẻ HDV" }]);
		expect(result.allMet).toBe(false);
	});

	it("invalidates the review fingerprint when evidence, profile or certificate status changes", () => {
		const fingerprint = levelDossierHash(dossier);
		expect(levelDossierHash({ ...dossier })).toBe(fingerprint);
		for (const changed of [
			{ ...dossier, profileVersion: 2 },
			{ ...dossier, skills: ["Updated"] },
			{ ...dossier, verificationStatus: "pending_review" },
			{ ...dossier, timesLed: 4 },
		])
			expect(levelDossierHash(changed)).not.toBe(fingerprint);
	});

	it("evaluates global trips, total km, average rating, certificates, and lists exact missing items", () => {
		const globalDossier: LevelDossier = {
			...dossier,
			completedTrips: 6,
			totalKmLed: 62.5,
			averageRating: 4.1,
			certificates: [],
		};
		const proficientPolicy: LevelDefinition = {
			name: "Thành thạo",
			minExperienceYears: 1,
			minTimesLed: null,
			minCompletedTrips: 10,
			minTotalKm: 100,
			minAverageRating: 4.2,
			requiredSkills: [],
			requiredCertifications: ["wfa"],
			responsibilities: "Dẫn đoàn chính",
		};

		const result = evaluateLevelCriteria(globalDossier, proficientPolicy, "2026-11-21");
		expect(result.allMet).toBe(false);
		expect(result.completedTrips).toBe(false);
		expect(result.totalKm).toBe(false);
		expect(result.averageRating).toBe(false);
		expect(result.missingItems?.map((i) => i.code)).toEqual([
			"missing_trips",
			"missing_km",
			"low_rating",
			"missing_cert",
		]);

		const pct = computeLevelProgressPercent(globalDossier, proficientPolicy, result);
		expect(pct).toBeGreaterThan(50);
		expect(pct).toBeLessThan(100);
	});
});
