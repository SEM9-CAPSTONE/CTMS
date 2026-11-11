import { createHash } from "node:crypto";
import type { LevelComparison, LevelDefinition, LevelDossier } from "./porter-levels.types";

export function comparePorterLevel(
	dossier: LevelDossier,
	definition: LevelDefinition
): LevelComparison {
	const missing = (required: string[], actual: string[]): string[] => {
		const facts = new Set(actual.map((value) => value.trim().toLocaleLowerCase("vi")));
		return required.filter((value) => !facts.has(value.trim().toLocaleLowerCase("vi")));
	};
	return {
		experience:
			definition.minExperienceYears === null
				? null
				: dossier.experienceYears >= definition.minExperienceYears,
		timesLed: definition.minTimesLed === null ? null : dossier.timesLed >= definition.minTimesLed,
		missingSkills: missing(definition.requiredSkills, dossier.skills),
		missingCertifications: missing(definition.requiredCertifications, dossier.certifications),
	};
}

export function levelDossierHash(dossier: LevelDossier): string {
	return createHash("sha256").update(JSON.stringify(dossier)).digest("hex");
}
