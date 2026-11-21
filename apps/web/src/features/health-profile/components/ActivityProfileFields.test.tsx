import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { type HealthProfileFormValues, healthProfileSchema } from "../schema/health-profile.schema";
import { ActivityProfileFields } from "./ActivityProfileFields";

function Editor() {
	const form = useForm<HealthProfileFormValues>({
		defaultValues: {
			activityProfile: {
				comfortableDistanceKm: 8,
				comfortableWalkingMinutes: 180,
				activityNotes: "Khó đi xuống dốc dài\n\nTránh mang ba lô nặng",
			},
		},
	});
	return <ActivityProfileFields form={form} disabled={false} />;
}

describe("simplified activity profile", () => {
	it("shows a single note field containing the combined notes and no weekly activity field", () => {
		render(<Editor />);
		expect(screen.getByRole("textbox", { name: "Lưu ý khi vận động" })).toHaveValue(
			"Khó đi xuống dốc dài\n\nTránh mang ba lô nặng"
		);
		expect(screen.getAllByRole("textbox")).toHaveLength(1);
		expect(screen.queryByLabelText("Số ngày vận động mỗi tuần")).not.toBeInTheDocument();
		expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
		expect(screen.queryByText(/Lần xác nhận/)).not.toBeInTheDocument();
	});
	it("accepts an activity profile without a note or weekly frequency", () => {
		expect(
			healthProfileSchema.safeParse({
				bloodType: "UNKNOWN",
				physicalFitnessLevel: "INTERMEDIATE",
				allergies: [],
				medicalConditions: [],
				isConsentGranted: true,
				activityProfile: {
					comfortableDistanceKm: 8,
					comfortableWalkingMinutes: 180,
				},
			}).success
		).toBe(true);
	});
});
