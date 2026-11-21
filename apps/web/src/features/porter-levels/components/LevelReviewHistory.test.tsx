import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { LevelDecision } from "../types";
import { LevelReviewHistory } from "./LevelReviewHistory";

it("labels a rejected direct decision as non-recognition without implying a rank change", () => {
	const decision: LevelDecision = {
		qualificationId: "qualification",
		porterId: "porter",
		routeId: "route",
		actorId: "admin",
		comparisonSnapshot: null,
		id: "decision",
		outcome: "rejected",
		source: "direct",
		fromLevel: "expert",
		toLevel: "expert",
		decidedAt: "2026-11-14T12:13:00Z",
		reason: "Chưa có minh chứng phù hợp",
		policySnapshot: {
			level: "expert",
			version: 1,
			updatedBy: "admin",
			updatedAt: "2026-11-14T12:13:00Z",
			definition: {
				name: "Chuyên gia",
				minExperienceYears: 5,
				minTimesLed: 25,
				requiredSkills: [],
				requiredCertifications: [],
				responsibilities: "Phụ trách tuyến",
			},
		},
		dossierSnapshot: {
			porterId: "porter",
			porterName: "Người hỗ trợ",
			profileVersion: 1,
			experienceYears: 5,
			timesLed: 28,
			skills: [],
			certifications: [],
			evidenceVersion: 1,
			verificationStatus: "approved",
			verificationUpdatedAt: null,
		},
	};
	render(<LevelReviewHistory items={[decision]} />);
	expect(screen.getByText(/^Không công nhận:/)).toBeInTheDocument();
	expect(screen.getByText("Giữ nguyên cấp hiện tại.")).toBeInTheDocument();
	expect(screen.queryByText(/→/)).not.toBeInTheDocument();
});
