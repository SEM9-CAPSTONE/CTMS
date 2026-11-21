import { RiskLevel } from "../weather/entities/weather-risk-assessment.entity";
import type { WeatherRiskRule } from "../weather/entities/weather-risk-rule.entity";
import { scoreWeatherReading } from "../weather/services/weather-risk-scoring";
import {
	WEATHER_MANUAL_ASSESSMENT_DATASETS,
	type WeatherManualAssessmentDataset,
	datasetHash,
	findManualAssessmentDataset,
} from "./datasets";
import {
	WeatherManualAssessmentDatasetStatus,
	WeatherRiskEvaluationGateName,
	WeatherRiskEvaluationStatus,
} from "./weather-risk-evaluation.enums";
import {
	type WeatherRiskCaseResult,
	computeMetrics,
	evaluateGates,
	evaluateWeatherRisk,
	scoreDatasetCases,
} from "./weather-risk-evaluation.metrics";

const { GREEN, YELLOW, RED } = RiskLevel;
const { OVERALL_AGREEMENT, MISSED_RED_RATE, FALSE_RED_RATE } = WeatherRiskEvaluationGateName;

/** The default rule seeded by CreateWeatherRiskTables. */
const DEFAULT_RULE = {
	id: "rule-1",
	version: 1,
	rainfallYellowThreshold: 10,
	rainfallRedThreshold: 50,
	windYellowThreshold: 40,
	windRedThreshold: 70,
	tempLowYellow: 5,
	tempLowRed: 0,
	tempHighYellow: 38,
	tempHighRed: 42,
	visibilityYellowThreshold: 5000,
	visibilityRedThreshold: 1000,
	thunderstormYellow: true,
	thunderstormRed: true,
	rainfallWeight: 0.3,
	windWeight: 0.25,
	temperatureWeight: 0.15,
	visibilityWeight: 0.15,
	thunderstormWeight: 0.15,
	greenMaxScore: 0.5,
	yellowMaxScore: 1.2,
	isActive: true,
} as WeatherRiskRule;

let next = 0;
/** Builds `count` results with the given manual and automated levels. */
function results(
	count: number,
	manualLevel: RiskLevel,
	automatedLevel: RiskLevel,
	boundary = false
): WeatherRiskCaseResult[] {
	return Array.from({ length: count }, () => ({
		caseId: `C${next++}`,
		manualLevel,
		automatedLevel,
		compositeScore: 0,
		boundary,
		matched: manualLevel === automatedLevel,
	}));
}

describe("Weather Risk evaluation metrics (CTMS-099)", () => {
	it("measures agreement, missed Red and false Red, and separates Green/Yellow/Red", () => {
		const metrics = computeMetrics([
			...results(8, GREEN, GREEN),
			...results(1, GREEN, YELLOW),
			...results(1, GREEN, RED),
			...results(9, YELLOW, YELLOW),
			...results(1, YELLOW, GREEN),
			...results(9, RED, RED),
			...results(1, RED, YELLOW),
		]);
		expect(metrics).toMatchObject({
			totalCases: 30,
			agreedCases: 26,
			overallAgreement: 0.8667,
			manualRedCases: 10,
			missedRedCases: 1,
			missedRedRate: 0.1,
			automatedRedCases: 10,
			falseRedCases: 1,
			falseRedRate: 0.1,
		});
		expect(metrics.byLevel[GREEN]).toEqual({
			cases: 10,
			agreed: 8,
			agreement: 0.8,
			automatedAs: { green: 8, yellow: 1, red: 1 },
		});
		expect(metrics.byLevel[YELLOW].automatedAs).toEqual({ green: 1, yellow: 9, red: 0 });
		expect(metrics.byLevel[RED]).toMatchObject({ cases: 10, agreed: 9, agreement: 0.9 });
	});

	it("reports boundary cases separately from the others", () => {
		const metrics = computeMetrics([
			...results(4, GREEN, GREEN, true),
			...results(4, GREEN, YELLOW, true),
			...results(10, RED, RED, false),
		]);
		expect(metrics.boundaryCases).toEqual({ cases: 8, agreed: 4, agreement: 0.5 });
		expect(metrics.nonBoundaryCases).toEqual({ cases: 10, agreed: 10, agreement: 1 });
	});

	it("passes every gate exactly at its threshold (90% / 5% / 10%)", () => {
		// 20 manual Red: 1 missed = 5%. 10 Red warnings: 1 false = 10%. 36 of 40 agree = 90%.
		const metrics = computeMetrics([
			...results(19, RED, RED),
			...results(1, RED, YELLOW),
			...results(1, YELLOW, RED),
			...results(17, GREEN, GREEN),
			...results(2, GREEN, YELLOW),
		]);
		// 19 Red warnings issued, 1 false = 5.26% -> pass; check agreement and missed exactly at gate.
		expect(metrics.agreedCases).toBe(36);
		expect(metrics.totalCases).toBe(40);
		const gates = evaluateGates(metrics);
		expect(gates[OVERALL_AGREEMENT]).toMatchObject({ actual: 0.9, threshold: 0.9, passed: true });
		expect(gates[MISSED_RED_RATE]).toMatchObject({ actual: 0.05, threshold: 0.05, passed: true });

		const falseRedAtGate = evaluateGates(
			computeMetrics([...results(9, RED, RED), ...results(1, GREEN, RED)])
		);
		expect(falseRedAtGate[FALSE_RED_RATE]).toMatchObject({ actual: 0.1, passed: true });
	});

	it("fails a gate just past its threshold", () => {
		const lowAgreement = evaluateGates(
			computeMetrics([
				...results(89, GREEN, GREEN),
				...results(11, GREEN, YELLOW),
				...results(1, RED, RED),
			])
		);
		expect(lowAgreement[OVERALL_AGREEMENT].passed).toBe(false);

		const missed = evaluateGates(
			computeMetrics([...results(18, RED, RED), ...results(2, RED, YELLOW)])
		);
		expect(missed[MISSED_RED_RATE]).toMatchObject({ actual: 0.1, passed: false });

		const falseRed = evaluateGates(
			computeMetrics([...results(8, RED, RED), ...results(2, YELLOW, RED)])
		);
		expect(falseRed[FALSE_RED_RATE]).toMatchObject({ actual: 0.2, passed: false });
	});

	it("counts no false Red when the scorer issued no Red warning", () => {
		const metrics = computeMetrics([...results(5, RED, YELLOW), ...results(5, GREEN, GREEN)]);
		expect(metrics).toMatchObject({ automatedRedCases: 0, falseRedRate: 0 });
		expect(evaluateGates(metrics)[FALSE_RED_RATE].passed).toBe(true);
	});

	it("scores cases with the production scorer and the given rule", () => {
		const dataset = findManualAssessmentDataset() as WeatherManualAssessmentDataset;
		const scored = scoreDatasetCases(dataset, DEFAULT_RULE);
		const first = dataset.cases[0];
		expect(scored[0]).toMatchObject({
			caseId: first.id,
			manualLevel: first.manualLevel,
			automatedLevel: scoreWeatherReading(first.readings, DEFAULT_RULE).riskLevel,
		});
	});
});

describe("Weather Risk evaluation outcome", () => {
	const approved = (
		cases: WeatherManualAssessmentDataset["cases"]
	): WeatherManualAssessmentDataset => ({
		version: "test-approved",
		status: WeatherManualAssessmentDatasetStatus.APPROVED,
		description: "test",
		approvedBy: "Guide",
		approvedAt: "2026-11-13",
		cases,
	});
	const calm = {
		rainfallMm: 0,
		windKph: 5,
		temperatureC: 25,
		visibilityM: 20000,
		thunderstorm: false,
	};
	const storm = {
		rainfallMm: 90,
		windKph: 90,
		temperatureC: 25,
		visibilityM: 300,
		thunderstorm: true,
	};

	it("passes an approved dataset the scorer agrees with", () => {
		const outcome = evaluateWeatherRisk(
			approved([
				{ id: "G", readings: calm, manualLevel: GREEN, boundary: false, note: "" },
				{ id: "R", readings: storm, manualLevel: RED, boundary: false, note: "" },
			]),
			DEFAULT_RULE
		);
		expect(outcome.overallResult).toBe(WeatherRiskEvaluationStatus.PASSED);
		expect(outcome.failureReasons).toEqual([]);
	});

	it("fails with a reason citing the BR when a gate is missed", () => {
		const outcome = evaluateWeatherRisk(
			approved([
				{ id: "R1", readings: calm, manualLevel: RED, boundary: false, note: "" },
				{ id: "R2", readings: storm, manualLevel: RED, boundary: false, note: "" },
			]),
			DEFAULT_RULE
		);
		expect(outcome.overallResult).toBe(WeatherRiskEvaluationStatus.FAILED);
		expect(outcome.failureReasons.join(" ")).toContain("Missed Red/high-risk rate 50% (1 of 2)");
		expect(outcome.failureReasons.join(" ")).toContain("AC-6");
	});

	it("is INVALID on a draft dataset or one without a Red case", () => {
		const draft = evaluateWeatherRisk(
			{
				...approved([{ id: "R", readings: storm, manualLevel: RED, boundary: false, note: "" }]),
				status: WeatherManualAssessmentDatasetStatus.DRAFT,
			},
			DEFAULT_RULE
		);
		expect(draft.overallResult).toBe(WeatherRiskEvaluationStatus.INVALID);
		expect(draft.failureReasons[0]).toContain("is a draft");

		const noRed = evaluateWeatherRisk(
			approved([{ id: "G", readings: calm, manualLevel: GREEN, boundary: false, note: "" }]),
			DEFAULT_RULE
		);
		expect(noRed.overallResult).toBe(WeatherRiskEvaluationStatus.INVALID);
		expect(noRed.metrics.missedRedRate).toBeNull();
		expect(noRed.failureReasons.join(" ")).toContain("no case labelled Red");
	});
});

describe("manual-assessment datasets", () => {
	it.each(WEATHER_MANUAL_ASSESSMENT_DATASETS.map((dataset) => [dataset.version, dataset]))(
		"%s is well-formed and covers every level and boundary cases",
		(_version, dataset) => {
			const ids = dataset.cases.map((testCase) => testCase.id);
			expect(new Set(ids).size).toBe(ids.length);
			for (const level of [GREEN, YELLOW, RED]) {
				expect(dataset.cases.some((testCase) => testCase.manualLevel === level)).toBe(true);
			}
			expect(dataset.cases.some((testCase) => testCase.boundary)).toBe(true);
			if (dataset.status === WeatherManualAssessmentDatasetStatus.APPROVED) {
				expect(dataset.approvedBy).toBeTruthy();
				expect(dataset.approvedAt).toBeTruthy();
			} else {
				expect(dataset.approvedBy).toBeNull();
			}
		}
	);

	it("versions are unique and the newest is the default", () => {
		const versions = WEATHER_MANUAL_ASSESSMENT_DATASETS.map((dataset) => dataset.version);
		expect(new Set(versions).size).toBe(versions.length);
		expect(findManualAssessmentDataset()?.version).toBe(versions.at(-1));
		expect(findManualAssessmentDataset("missing")).toBeNull();
	});

	it("v1 is the 60-case draft and its hash changes when a label changes", () => {
		const v1 = WEATHER_MANUAL_ASSESSMENT_DATASETS[0];
		expect(v1).toMatchObject({ status: WeatherManualAssessmentDatasetStatus.DRAFT });
		expect(v1.cases).toHaveLength(60);
		expect(v1.cases.filter((testCase) => testCase.boundary)).toHaveLength(18);
		const hash = datasetHash(v1);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
		const relabelled = {
			...v1,
			cases: v1.cases.map((testCase, index) =>
				index === 0 ? { ...testCase, manualLevel: YELLOW } : testCase
			),
		};
		expect(datasetHash(relabelled)).not.toBe(hash);
	});
});
