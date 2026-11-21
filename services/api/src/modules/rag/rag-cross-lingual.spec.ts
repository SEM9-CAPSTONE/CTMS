import {
	NATURAL_PREPARATION_QUESTIONS,
	TRIP_PLANNING_CHECKLIST,
} from "../../../test/support/trip-planning-retrieval-fixture";
import { crossLingualCorroboration } from "./rag-cross-lingual";

describe("Cross-language planning and safety corroboration", () => {
	it.each(NATURAL_PREPARATION_QUESTIONS)(
		"matches natural preparation intent against the source body: %s",
		(question) => {
			expect(crossLingualCorroboration(question, "vi")(TRIP_PLANNING_CHECKLIST, "en")).toBe(true);
		}
	);
	it.each([
		"Consider the following:",
		"Camping tent:",
		"START HERE",
		"Prepare for trekking",
		"Prepare the quarterly revenue report before the audit.",
		"Prepare the patient for the examination before treatment.",
	])("does not turn a form label or unrelated preparation into outdoor guidance: %s", (body) => {
		expect(crossLingualCorroboration(NATURAL_PREPARATION_QUESTIONS[0], "vi")(body, "en")).toBe(
			false
		);
	});
	it("preserves complete corroboration of specific safety topics despite general preparation wording", () => {
		const corroborates = crossLingualCorroboration(
			"Đi trekking cần chuẩn bị bản đồ và la bàn thế nào?",
			"vi"
		);
		expect(corroborates("Read the map and compass before leaving.", "en")).toBe(true);
		expect(corroborates("Carry a map on every hike.", "en")).toBe(false);
	});
	it("does not answer a specific lightning question with a generic trip checklist", () => {
		const corroborates = crossLingualCorroboration(
			"Cần chuẩn bị gì để tránh sét khi trekking?",
			"vi"
		);
		expect(corroborates(TRIP_PLANNING_CHECKLIST, "en")).toBe(false);
		expect(corroborates("Seek shelter during lightning.", "en")).toBe(true);
	});
	it.each([
		"Trước khi đi mình nên báo cho người nhà những thông tin nào?",
		"Làm sao biết cung đường đó có quá sức với mình?",
	])("corroborates a natural planning topic in the literal checklist: %s", (question) => {
		expect(crossLingualCorroboration(question, "vi")(TRIP_PLANNING_CHECKLIST, "en")).toBe(true);
	});
	it("does not confuse a self-check or an experience recap with contact and fitness guidance", () => {
		expect(
			crossLingualCorroboration("Trước khi đi cần báo cho người nhà những gì?", "vi")(
				"Check in with yourself: Should you continue?",
				"en"
			)
		).toBe(false);
		const fitness = crossLingualCorroboration("Cung đường này có quá sức với mình không?", "vi");
		expect(fitness("Skill:", "en")).toBe(false);
		expect(fitness("Think about lessons learned and share your experience.", "en")).toBe(false);
		expect(crossLingualCorroboration("Thời tiết ra sao?", "vi")("Weather:", "en")).toBe(false);
	});
	it("handles decomposed Vietnamese without changing the source language", () => {
		expect(
			crossLingualCorroboration(NATURAL_PREPARATION_QUESTIONS[0].normalize("NFD"), "vi")(
				TRIP_PLANNING_CHECKLIST,
				"en"
			)
		).toBe(true);
	});
	it("keeps unknown intents and unsupported language pairs ineligible", () => {
		expect(
			crossLingualCorroboration("Mua cổ phiếu nào?", "vi")(TRIP_PLANNING_CHECKLIST, "en")
		).toBe(false);
		expect(
			crossLingualCorroboration(NATURAL_PREPARATION_QUESTIONS[0], "vi")(
				TRIP_PLANNING_CHECKLIST,
				"fr"
			)
		).toBe(false);
		expect(
			crossLingualCorroboration("Préparer un voyage", "fr")(TRIP_PLANNING_CHECKLIST, "en")
		).toBe(false);
	});
});
