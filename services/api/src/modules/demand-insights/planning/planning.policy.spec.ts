import {
	type PlanningCandidate,
	type PlanningSource,
	buildPlanningContext,
	presentPlanning,
	validatePlanning,
} from "./planning.policy";
const release = {
	granularity: "trip_type_difficulty" as const,
	cells: [{ tripType: "day_trip", difficulty: "easy", bookerBand: { min: 10, max: 19 } }],
};
const source: PlanningSource = {
	booking: "private-booking",
	booker: "private-booker",
	host: "private-host",
	tripType: "day_trip",
	difficulty: "easy",
	snapshotType: "day_trip",
	snapshotDifficulty: "easy",
	priceBand: "under_500k",
	capacityBand: "11_to_20",
	durationBand: "day",
	areaCode: "demo-east",
	areaLabel: "Khu vực mẫu",
	areaActive: true,
};
const candidate = () => buildPlanningContext(release, [source]).candidates[0];
describe("Grounded planning policy", () => {
	it("enriches only the same whole released cohort without disclosing source identities", () => {
		const value = buildPlanningContext(release, [source]);
		expect(value.candidates[0]).toMatchObject({
			priceBand: "under_500k",
			capacityBand: "11_to_20",
			area: { code: "demo-east" },
			bookerBand: { min: 10, max: 19 },
		});
		expect(JSON.stringify(value)).not.toMatch(/private-booking|private-booker|private-host/);
	});
	it.each(["priceBand", "capacityBand", "durationBand"] as const)(
		"omits heterogeneous or missing %s instead of a majority/marginal",
		(field) => {
			for (const other of [null, "unknown"]) {
				const value = buildPlanningContext(release, [source, { ...source, [field]: other }]);
				expect(value.candidates[0][field]).toBeNull();
				expect(value.candidates[0].bookerBand).toEqual(release.cells[0].bookerBand);
			}
		}
	);
	it("omits areas that are missing, inactive or mixed", () => {
		for (const patch of [{ areaCode: null }, { areaActive: false }, { areaCode: "demo-west" }])
			expect(
				buildPlanningContext(release, [source, { ...source, ...patch }]).candidates[0].area
			).toBeNull();
	});
	it("does not turn absent/mismatched legacy snapshots into free or zero evidence", () => {
		const c = buildPlanningContext(release, [{ ...source, snapshotType: null }]).candidates[0];
		expect(c.priceBand).toBeNull();
		expect(c.capacityBand).toBeNull();
		expect(c.durationBand).toBeNull();
		expect(c.area).toBeNull();
	});
	it("does not combine independent profile dimensions or introduce new candidates", () => {
		const context = buildPlanningContext(release, [
			source,
			{ ...source, priceBand: "1m_plus", capacityBand: "41_plus" },
		]);
		expect(context.candidates).toHaveLength(1);
		expect(context.candidates[0]).toMatchObject({ priceBand: null, capacityBand: null });
	});
	it.each([
		{ recommendations: [{ candidateId: "c9", focusCodes: ["balanced_pace"] }] },
		{ recommendations: [{ candidateId: "c1", focusCodes: ["overnight_preparation"] }] },
		{ recommendations: [{ candidateId: "c1", focusCodes: ["balanced_pace", "balanced_pace"] }] },
		{ recommendations: [{ candidateId: "c1", focusCodes: ["balanced_pace"], price: 100 }] },
		{
			recommendations: [
				{ candidateId: "c1", focusCodes: ["balanced_pace"] },
				{ candidateId: "c1", focusCodes: ["clear_inclusions"] },
			],
		},
		{ recommendations: [] },
	])("rejects unsupported IDs/codes/numbers/duplicates: %j", (raw) => {
		expect(() => validatePlanning(raw, [candidate()])).toThrow("invalid_output");
	});
	it("does not allow price/capacity advice without matching evidence", () => {
		const c: PlanningCandidate = { ...candidate(), priceBand: null, capacityBand: null };
		for (const code of ["price_transparency", "group_organization"])
			expect(() =>
				validatePlanning({ recommendations: [{ candidateId: "c1", focusCodes: [code] }] }, [c])
			).toThrow();
	});
	it("returns code-selected guidance and facts from the frozen candidate", () => {
		const choices = validatePlanning(
			{
				recommendations: [
					{ candidateId: "c1", focusCodes: ["price_transparency", "group_organization"] },
				],
			},
			[candidate()]
		);
		const value = presentPlanning(choices, [candidate()]);
		expect(value[0]).toMatchObject({
			priceBand: "under_500k",
			capacityMeaning: "offered_at_booking",
			evidenceBasis: "observed_bookings",
		});
		expect(value[0].generalAdvice).toHaveLength(2);
	});
});
