import type { PorterAvailabilityStatus, PorterProfile, PorterRouteProficiency } from "./types";

export const MAX_CERTIFICATIONS = 20;
export const MAX_LANGUAGES = 20;
export const MAX_TAG_LENGTH = 100;

export const DEFAULT_VIRTUAL_PORTER_PROFILE: PorterProfile = {
	porterId: "",
	experienceYears: 0,
	certifications: [],
	languages: [],
	availabilityStatus: "unavailable",
	ratingAvg: 0,
	completedTrips: 0,
	version: 0,
	createdAt: null,
	updatedAt: null,
};

export const AVAILABILITY_STATUS_LABELS: Record<PorterAvailabilityStatus, string> = {
	available: "Sẵn sàng nhận ca (Available)",
	unavailable: "Tạm ngưng nhận ca (Unavailable)",
};

export const PROFICIENCY_LABELS: Record<PorterRouteProficiency, string> = {
	learning: "Học việc (Learning)",
	proficient: "Thành thạo (Proficient)",
	expert: "Chuyên gia (Expert)",
};

export const PROFICIENCY_DESCRIPTIONS: Record<PorterRouteProficiency, string> = {
	learning: "Đang làm quen với tuyến đường, chưa đủ điều kiện dẫn đoàn độc lập (Lead).",
	proficient: "Đã am hiểu tuyến đường, có kinh nghiệm hỗ trợ và dẫn đoàn an toàn.",
	expert: "Chuyên gia địa hình trên tuyến, có thể xử lý mọi tình huống khẩn cấp phức tạp.",
};

export function isLeadEligible(qualification: {
	proficiency: PorterRouteProficiency;
	verifiedBy: string | null;
	verifiedAt: string | null;
}): boolean {
	const isVerified = Boolean(qualification.verifiedBy && qualification.verifiedAt);
	return isVerified && qualification.proficiency !== "learning";
}
