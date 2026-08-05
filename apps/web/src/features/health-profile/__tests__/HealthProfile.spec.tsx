import type { HealthProfileData } from "../types";

export function validateHealthProfileData(profile: HealthProfileData): boolean {
	if (!profile.id || !profile.camperId) return false;
	if (profile.consent.isConsentGranted && profile.consent.allowedRoles.length === 0) return false;
	return true;
}

// Validation test assertions
const sampleProfile: HealthProfileData = {
	id: "hp-001",
	camperId: "cmp-001",
	camperName: "Minh Quân",
	bloodType: "O+",
	physicalFitnessLevel: "INTERMEDIATE",
	dietaryRestrictions: "Vegetarian",
	emergencyNotes: "Penicillin allergy",
	allergies: [{ id: "alg-1", name: "Penicillin", severity: "HIGH" }],
	medicalConditions: [{ id: "med-1", name: "Asthma", medication: "Inhaler" }],
	consent: {
		isConsentGranted: true,
		allowedRoles: ["HOST", "PORTER"],
		activeTripScope: "TRIP-2026-FANSIPAN-01",
	},
	accountStatus: "ACTIVE",
	updatedAt: new Date().toISOString(),
	version: 1,
};

if (!validateHealthProfileData(sampleProfile)) {
	throw new Error("Health profile validation failed");
}
