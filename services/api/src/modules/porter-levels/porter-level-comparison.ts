import { createHash } from "node:crypto";
import type {
	CertificateEvaluationItem,
	LevelComparison,
	LevelDefinition,
	LevelDossier,
} from "./porter-levels.types";

export function getVietnamDateString(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(d);
}

export function evaluateLevelCriteria(
	dossier: LevelDossier,
	definition: LevelDefinition,
	now: Date | string = new Date()
): LevelComparison {
	const todayStr = getVietnamDateString(now);

	const missing = (required: string[], actual: string[]): string[] => {
		const facts = new Set(actual.map((value) => value.trim().toLocaleLowerCase("vi")));
		return required.filter((value) => !facts.has(value.trim().toLocaleLowerCase("vi")));
	};

	const missingSkills = missing(definition.requiredSkills, dossier.skills);

	const missingCertifications: string[] = [];
	const expiredCertifications: string[] = [];
	const rejectedCertifications: Array<{
		type: string;
		name: string;
		rejectionReason?: string | null;
	}> = [];
	const pendingCertifications: Array<{ type: string; name: string }> = [];
	const certificateDetails: CertificateEvaluationItem[] = [];

	for (const req of definition.requiredCertifications) {
		const reqNorm = req.trim().toLowerCase();

		// Check modern certificates table first
		const modernMatched = dossier.certificates?.find((c) => {
			const typeNorm = c.type.trim().toLowerCase();
			const nameNorm = c.name.trim().toLowerCase();
			return typeNorm === reqNorm || nameNorm.includes(reqNorm) || reqNorm.includes(nameNorm);
		});

		if (modernMatched) {
			const expiryStr =
				typeof modernMatched.expiryDate === "string"
					? modernMatched.expiryDate.slice(0, 10)
					: getVietnamDateString(modernMatched.expiryDate);

			if (modernMatched.status === "verified") {
				// Must not be expired: >= today in Vietnam time
				if (expiryStr >= todayStr) {
					certificateDetails.push({
						reqCode: req,
						name: modernMatched.name,
						status: "verified",
						expiryDate: modernMatched.expiryDate,
						met: true,
					});
				} else {
					expiredCertifications.push(req);
					certificateDetails.push({
						reqCode: req,
						name: modernMatched.name,
						status: "expired",
						expiryDate: modernMatched.expiryDate,
						met: false,
					});
				}
			} else if (modernMatched.status === "rejected") {
				rejectedCertifications.push({
					type: modernMatched.type,
					name: modernMatched.name,
					rejectionReason: modernMatched.rejectionReason,
				});
				certificateDetails.push({
					reqCode: req,
					name: modernMatched.name,
					status: "rejected",
					rejectionReason: modernMatched.rejectionReason,
					met: false,
				});
			} else if (modernMatched.status === "pending") {
				pendingCertifications.push({
					type: modernMatched.type,
					name: modernMatched.name,
				});
				certificateDetails.push({
					reqCode: req,
					name: modernMatched.name,
					status: "pending",
					met: false,
				});
			} else {
				missingCertifications.push(req);
				certificateDetails.push({
					reqCode: req,
					name: req,
					status: "missing",
					met: false,
				});
			}
		} else {
			// Fallback check against legacy dossier.certifications array
			const legacyMatched = dossier.certifications.some((c) => {
				const cNorm = c.trim().toLowerCase();
				return cNorm === reqNorm || cNorm.includes(reqNorm);
			});

			if (legacyMatched) {
				certificateDetails.push({
					reqCode: req,
					name: req,
					status: "verified",
					met: true,
				});
			} else {
				missingCertifications.push(req);
				certificateDetails.push({
					reqCode: req,
					name: req,
					status: "missing",
					met: false,
				});
			}
		}
	}

	const experienceMet =
		definition.minExperienceYears === null
			? null
			: dossier.experienceYears >= definition.minExperienceYears;

	const timesLedMet =
		definition.minTimesLed === null ? null : dossier.timesLed >= definition.minTimesLed;

	const certsMet =
		missingCertifications.length === 0 &&
		expiredCertifications.length === 0 &&
		rejectedCertifications.length === 0 &&
		pendingCertifications.length === 0;

	const allMet =
		experienceMet !== false && timesLedMet !== false && missingSkills.length === 0 && certsMet;

	return {
		experience: experienceMet,
		timesLed: timesLedMet,
		missingSkills,
		missingCertifications,
		expiredCertifications,
		rejectedCertifications,
		pendingCertifications,
		certificateDetails,
		allMet,
	};
}

export const comparePorterLevel = evaluateLevelCriteria;

export function levelDossierHash(dossier: LevelDossier): string {
	return createHash("sha256").update(JSON.stringify(dossier)).digest("hex");
}
