import { describe, expect, it } from "vitest";
import type { HealthProfileData } from "../types";

function validateHealthProfileData(profile: HealthProfileData): boolean {
	if (!profile.id || !profile.camperId) return false;
	if (profile.consent.isConsentGranted && profile.consent.allowedRoles.length === 0) return false;
	return true;
}

describe("validateHealthProfileData", () => {
	it("accepts a complete consented health profile", () => {
		const sampleProfile: HealthProfileData = {
			id: "hp-001",
			camperId: "cmp-001",
			camperName: "Minh Quan",
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

		expect(validateHealthProfileData(sampleProfile)).toBe(true);
	});
});
