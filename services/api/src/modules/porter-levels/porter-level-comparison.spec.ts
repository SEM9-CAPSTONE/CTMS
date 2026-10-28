import { comparePorterLevel, levelDossierHash } from "./porter-level-comparison";
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
describe("Porter level comparison", () => {
	it("compares inclusive thresholds and normalized text without mutating the dossier", () => {
		const original = JSON.stringify(dossier);
		expect(comparePorterLevel(dossier, definition)).toEqual({
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
});
