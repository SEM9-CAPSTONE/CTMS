import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import type { HealthProfileFormValues } from "../schema/health-profile.schema";
import type { HealthProfileData, HealthProfileResponse } from "../types";

const INITIAL_MOCK_HEALTH_PROFILE: HealthProfileData = {
	id: "hp-001",
	camperId: "cmp-001",
	camperName: "Minh Quân",
	bloodType: "O+",
	physicalFitnessLevel: "INTERMEDIATE",
	dietaryRestrictions: "Ăn chay nhẹ, không ăn hải sản có vỏ",
	emergencyNotes: "Tiền sử dị ứng với Penicillin. Cần mang theo bút tiêm EpiPen khi đi rừng rậm.",
	allergies: [
		{ id: "alg-1", name: "Penicillin", severity: "HIGH", reaction: "Phát ban, khó thở nhẹ" },
		{ id: "alg-2", name: "Tôm hùm / Cua", severity: "MEDIUM", reaction: "Ngứa ngoài da" },
	],
	medicalConditions: [
		{
			id: "med-1",
			name: "Hen suyễn nhẹ",
			medication: "Chai xịt Salbutamol",
			notes: "Dùng khi leo dốc cao",
		},
	],
	consent: {
		isConsentGranted: true,
		grantedAt: "2026-07-28T08:00:00Z",
		allowedRoles: ["HOST", "PORTER"],
		activeTripScope: "TRIP-2026-FANSIPAN-01",
	},
	accountStatus: "ACTIVE",
	updatedAt: new Date().toISOString(),
	version: 1,
};

let currentHealthProfile: HealthProfileData = { ...INITIAL_MOCK_HEALTH_PROFILE };

export const healthProfileService = {
	getHealthProfile: async (): Promise<HealthProfileData> => {
		try {
			// In production, calls httpClient.get(API_ENDPOINTS.HEALTH_PROFILE.GET)
			const res = await httpClient.get<HealthProfileResponse>(API_ENDPOINTS.HEALTH_PROFILE.GET);
			if (res?.data) return res.data;
		} catch {
			// Fallback to simulated local state
		}
		await new Promise((resolve) => setTimeout(resolve, 150));
		return { ...currentHealthProfile };
	},

	updateHealthProfile: async (
		values: HealthProfileFormValues,
		version: number
	): Promise<HealthProfileData> => {
		// Simulating concurrency check (BR-242) if version mismatch
		if (version < currentHealthProfile.version) {
			const error = new Error("CONFLICT");
			(error as unknown as { statusCode: number }).statusCode = 409;
			throw error;
		}

		currentHealthProfile = {
			...currentHealthProfile,
			bloodType: values.bloodType,
			physicalFitnessLevel: values.physicalFitnessLevel,
			dietaryRestrictions: values.dietaryRestrictions || "",
			emergencyNotes: values.emergencyNotes || "",
			allergies: [...values.allergies],
			medicalConditions: [...values.medicalConditions],
			consent: {
				...currentHealthProfile.consent,
				isConsentGranted: values.isConsentGranted,
				grantedAt: values.isConsentGranted
					? new Date().toISOString()
					: currentHealthProfile.consent.grantedAt,
				revokedAt: !values.isConsentGranted
					? new Date().toISOString()
					: currentHealthProfile.consent.revokedAt,
			},
			updatedAt: new Date().toISOString(),
			version: currentHealthProfile.version + 1,
		};

		await new Promise((resolve) => setTimeout(resolve, 200));
		return { ...currentHealthProfile };
	},

	revokeConsent: async (): Promise<HealthProfileData> => {
		currentHealthProfile = {
			...currentHealthProfile,
			consent: {
				...currentHealthProfile.consent,
				isConsentGranted: false,
				revokedAt: new Date().toISOString(),
			},
			updatedAt: new Date().toISOString(),
			version: currentHealthProfile.version + 1,
		};
		await new Promise((resolve) => setTimeout(resolve, 150));
		return { ...currentHealthProfile };
	},

	grantConsent: async (): Promise<HealthProfileData> => {
		currentHealthProfile = {
			...currentHealthProfile,
			consent: {
				...currentHealthProfile.consent,
				isConsentGranted: true,
				grantedAt: new Date().toISOString(),
			},
			updatedAt: new Date().toISOString(),
			version: currentHealthProfile.version + 1,
		};
		await new Promise((resolve) => setTimeout(resolve, 150));
		return { ...currentHealthProfile };
	},
};
