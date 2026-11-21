import { createHash } from "node:crypto";
import type {
	CertificateEvaluationItem,
	LevelComparison,
	LevelDefinition,
	LevelDossier,
	LevelGapItem,
} from "./porter-levels.types";

const CERT_CODE_LABELS_VI: Record<string, string> = {
	wfa: "Sơ cứu nơi hoang dã (WFA)",
	rescue: "Cứu hộ địa hình / Leo núi",
	guide_card: "Thẻ hướng dẫn viên du lịch",
	other: "Chứng chỉ chuyên môn khác",
};

export function certLabelVi(codeOrName: string): string {
	return CERT_CODE_LABELS_VI[codeOrName.trim().toLowerCase()] ?? codeOrName;
}

function normalizeCertMatch(reqCode: string, certType: string, certName: string): boolean {
	const reqNorm = reqCode.trim().toLowerCase();
	const typeNorm = certType.trim().toLowerCase();
	const nameNorm = certName.trim().toLowerCase();
	if (typeNorm === reqNorm || nameNorm.includes(reqNorm) || reqNorm.includes(nameNorm)) {
		return true;
	}
	if (reqNorm.includes("wfa") || reqNorm.includes("sơ cứu") || reqNorm.includes("sơ cấp cứu")) {
		return typeNorm === "wfa";
	}
	if (reqNorm.includes("rescue") || reqNorm.includes("cứu hộ")) {
		return typeNorm === "rescue";
	}
	if (reqNorm.includes("guide") || reqNorm.includes("hướng dẫn viên")) {
		return typeNorm === "guide_card";
	}
	return false;
}

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
		const modernMatched = dossier.certificates?.find((c) =>
			normalizeCertMatch(req, c.type, c.name)
		);

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

	const actualTrips = dossier.completedTrips ?? dossier.timesLed;
	const completedTripsMet =
		definition.minCompletedTrips === undefined || definition.minCompletedTrips === null
			? null
			: actualTrips >= definition.minCompletedTrips;

	const actualKm = dossier.totalKmLed ?? 0;
	const totalKmMet =
		definition.minTotalKm === undefined || definition.minTotalKm === null
			? null
			: actualKm >= definition.minTotalKm;

	const actualRating = dossier.averageRating ?? 0;
	const averageRatingMet =
		definition.minAverageRating === undefined || definition.minAverageRating === null
			? null
			: actualRating >= definition.minAverageRating;

	const certsMet =
		missingCertifications.length === 0 &&
		expiredCertifications.length === 0 &&
		rejectedCertifications.length === 0 &&
		pendingCertifications.length === 0;

	const missingItems: LevelGapItem[] = [];

	if (completedTripsMet === false && definition.minCompletedTrips != null) {
		const diff = Math.max(1, definition.minCompletedTrips - actualTrips);
		missingItems.push({
			code: "missing_trips",
			label: `Thiếu ${diff} chuyến hoàn thành`,
			detail: `Hiện có ${actualTrips} / ${definition.minCompletedTrips} chuyến đã dẫn hoàn thành.`,
			actionType: "complete_trips",
		});
	}

	if (totalKmMet === false && definition.minTotalKm != null) {
		const diff = Math.max(0.1, Number((definition.minTotalKm - actualKm).toFixed(1)));
		missingItems.push({
			code: "missing_km",
			label: `Thiếu ${diff} km đã dẫn`,
			detail: `Hiện có ${Number(actualKm.toFixed(1))} / ${definition.minTotalKm} km trekking tích lũy.`,
			actionType: "complete_trips",
		});
	}

	if (averageRatingMet === false && definition.minAverageRating != null) {
		missingItems.push({
			code: "low_rating",
			label: `Điểm đánh giá chưa đạt (${actualRating.toFixed(1)}★ / ${definition.minAverageRating.toFixed(1)}★)`,
			detail: `Cần duy trì điểm đánh giá trung bình tối thiểu ${definition.minAverageRating.toFixed(1)}★.`,
			actionType: "improve_rating",
		});
	}

	// minExperienceYears is an optional / advisory condition (not mandatory)

	for (const reqCode of missingCertifications) {
		missingItems.push({
			code: "missing_cert",
			label: `Thiếu chứng chỉ: ${certLabelVi(reqCode)}`,
			detail: "Vui lòng tải lên chứng chỉ hợp lệ để Quản trị viên xác minh.",
			actionType: "upload_cert",
		});
	}
	for (const reqCode of expiredCertifications) {
		missingItems.push({
			code: "expired_cert",
			label: `Chứng chỉ hết hạn: ${certLabelVi(reqCode)}`,
			detail: "Chứng chỉ đã quá hạn hiệu lực, cần gia hạn và tải lên bản mới.",
			actionType: "upload_cert",
		});
	}
	for (const cert of pendingCertifications) {
		missingItems.push({
			code: "pending_cert",
			label: `Chứng chỉ đang chờ duyệt: ${cert.name || certLabelVi(cert.type)}`,
			detail: "Quản trị viên đang xem xét xác minh chứng chỉ này.",
			actionType: "upload_cert",
		});
	}
	for (const cert of rejectedCertifications) {
		missingItems.push({
			code: "rejected_cert",
			label: `Chứng chỉ bị từ chối: ${cert.name || certLabelVi(cert.type)}`,
			detail: cert.rejectionReason
				? `Lý do từ chối: ${cert.rejectionReason}. Vui lòng tải lại bản rõ nét.`
				: "Vui lòng kiểm tra và tải lại chứng chỉ hợp lệ.",
			actionType: "upload_cert",
		});
	}
	for (const skill of missingSkills) {
		missingItems.push({
			code: "missing_skill",
			label: `Chưa khai báo kỹ năng: ${skill}`,
			detail: "Cập nhật kỹ năng này trong hồ sơ năng lực của bạn.",
			actionType: "update_skills",
		});
	}

	const allMet =
		timesLedMet !== false &&
		completedTripsMet !== false &&
		totalKmMet !== false &&
		averageRatingMet !== false &&
		missingSkills.length === 0 &&
		certsMet;

	return {
		experience: experienceMet,
		timesLed: timesLedMet,
		completedTrips: completedTripsMet,
		totalKm: totalKmMet,
		averageRating: averageRatingMet,
		missingSkills,
		missingCertifications,
		expiredCertifications,
		rejectedCertifications,
		pendingCertifications,
		certificateDetails,
		missingItems,
		allMet,
	};
}

export function computeLevelProgressPercent(
	dossier: LevelDossier,
	definition: LevelDefinition,
	comparison: LevelComparison
): number {
	const scores: number[] = [];

	if (definition.minCompletedTrips != null && definition.minCompletedTrips > 0) {
		const actual = dossier.completedTrips ?? dossier.timesLed;
		scores.push(Math.min(1, actual / definition.minCompletedTrips));
	}
	if (definition.minTotalKm != null && definition.minTotalKm > 0) {
		const actual = dossier.totalKmLed ?? 0;
		scores.push(Math.min(1, actual / definition.minTotalKm));
	}
	if (definition.minAverageRating != null && definition.minAverageRating > 0) {
		const actual = dossier.averageRating ?? 0;
		scores.push(Math.min(1, actual / definition.minAverageRating));
	}
	if (definition.requiredCertifications.length > 0) {
		const metCerts = comparison.certificateDetails.filter((c) => c.met).length;
		scores.push(metCerts / definition.requiredCertifications.length);
	}
	if (definition.requiredSkills.length > 0) {
		const metSkills = definition.requiredSkills.length - comparison.missingSkills.length;
		scores.push(Math.max(0, metSkills) / definition.requiredSkills.length);
	}

	if (scores.length === 0) return 100;
	const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
	return Math.round(avg * 100);
}

export const comparePorterLevel = evaluateLevelCriteria;

export function levelDossierHash(dossier: LevelDossier): string {
	return createHash("sha256").update(JSON.stringify(dossier)).digest("hex");
}
