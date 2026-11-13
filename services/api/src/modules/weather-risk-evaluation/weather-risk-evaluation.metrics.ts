import { RiskLevel } from "../weather/entities/weather-risk-assessment.entity";
import type { WeatherRiskRule } from "../weather/entities/weather-risk-rule.entity";
import { scoreWeatherReading } from "../weather/services/weather-risk-scoring";
import type { WeatherManualAssessmentDataset } from "./datasets";
import { WEATHER_RISK_RELEASE_GATES } from "./weather-risk-evaluation.constants";
import {
	WeatherManualAssessmentDatasetStatus,
	WeatherRiskEvaluationGateName,
	WeatherRiskEvaluationStatus,
} from "./weather-risk-evaluation.enums";

const LEVELS = [RiskLevel.GREEN, RiskLevel.YELLOW, RiskLevel.RED] as const;

export interface WeatherRiskCaseResult {
	caseId: string;
	manualLevel: RiskLevel;
	automatedLevel: RiskLevel;
	compositeScore: number;
	boundary: boolean;
	matched: boolean;
}

export interface AgreementSlice {
	cases: number;
	agreed: number;
	/** Fraction 0..1 rounded to 4 decimals; null when the slice is empty. */
	agreement: number | null;
}

export interface LevelBreakdown extends AgreementSlice {
	/** How the scorer classified the cases the evaluator labelled with this level. */
	automatedAs: Record<RiskLevel, number>;
}

export interface WeatherRiskEvaluationMetrics {
	totalCases: number;
	agreedCases: number;
	overallAgreement: number | null;
	/** Cases the evaluator labelled Red. */
	manualRedCases: number;
	/** Of those, the scorer did not say Red. */
	missedRedCases: number;
	/** null when the dataset has no Red case: the safety gate cannot be measured. */
	missedRedRate: number | null;
	/** Red warnings the scorer issued. */
	automatedRedCases: number;
	/** Of those, the evaluator did not say Red. */
	falseRedCases: number;
	/** 0 when the scorer issued no Red warning (no false warning possible). */
	falseRedRate: number;
	/** Green / Yellow / Red reported separately (BR-280, AC-8), keyed by the manual level. */
	byLevel: Record<RiskLevel, LevelBreakdown>;
	/** Observational only (BR-282): never fails the release on its own. */
	boundaryCases: AgreementSlice;
	nonBoundaryCases: AgreementSlice;
}

export interface WeatherRiskGateResult {
	gateName: WeatherRiskEvaluationGateName;
	/** Fractions 0..1, like the other evaluation reports. */
	threshold: number;
	actual: number | null;
	comparator: ">=" | "<=";
	passed: boolean;
	unit: "ratio";
}

export interface WeatherRiskEvaluationOutcome {
	caseResults: WeatherRiskCaseResult[];
	metrics: WeatherRiskEvaluationMetrics;
	gates: Record<WeatherRiskEvaluationGateName, WeatherRiskGateResult>;
	overallResult: WeatherRiskEvaluationStatus;
	failureReasons: string[];
}

const ratio = (part: number, whole: number): number | null =>
	whole === 0 ? null : Number((part / whole).toFixed(4));

const slice = (results: WeatherRiskCaseResult[]): AgreementSlice => {
	const agreed = results.filter((result) => result.matched).length;
	return { cases: results.length, agreed, agreement: ratio(agreed, results.length) };
};

/** Scores every case with the given rule, exactly as production does (BR-041 scorer). */
export function scoreDatasetCases(
	dataset: WeatherManualAssessmentDataset,
	rule: WeatherRiskRule
): WeatherRiskCaseResult[] {
	return dataset.cases.map((testCase) => {
		const scored = scoreWeatherReading(testCase.readings, rule);
		return {
			caseId: testCase.id,
			manualLevel: testCase.manualLevel,
			automatedLevel: scored.riskLevel,
			compositeScore: scored.compositeScore,
			boundary: testCase.boundary,
			matched: scored.riskLevel === testCase.manualLevel,
		};
	});
}

export function computeMetrics(results: WeatherRiskCaseResult[]): WeatherRiskEvaluationMetrics {
	const manualRed = results.filter((result) => result.manualLevel === RiskLevel.RED);
	const automatedRed = results.filter((result) => result.automatedLevel === RiskLevel.RED);
	const missedRedCases = manualRed.filter(
		(result) => result.automatedLevel !== RiskLevel.RED
	).length;
	const falseRedCases = automatedRed.filter(
		(result) => result.manualLevel !== RiskLevel.RED
	).length;
	const overall = slice(results);

	const byLevel = Object.fromEntries(
		LEVELS.map((level) => {
			const labelled = results.filter((result) => result.manualLevel === level);
			const automatedAs = Object.fromEntries(
				LEVELS.map((auto) => [auto, labelled.filter((r) => r.automatedLevel === auto).length])
			) as Record<RiskLevel, number>;
			return [level, { ...slice(labelled), automatedAs }];
		})
	) as Record<RiskLevel, LevelBreakdown>;

	return {
		totalCases: overall.cases,
		agreedCases: overall.agreed,
		overallAgreement: overall.agreement,
		manualRedCases: manualRed.length,
		missedRedCases,
		missedRedRate: ratio(missedRedCases, manualRed.length),
		automatedRedCases: automatedRed.length,
		falseRedCases,
		falseRedRate: ratio(falseRedCases, automatedRed.length) ?? 0,
		byLevel,
		boundaryCases: slice(results.filter((result) => result.boundary)),
		nonBoundaryCases: slice(results.filter((result) => !result.boundary)),
	};
}

/**
 * BR-280 gates, decided on integer counts so a value exactly at a threshold passes (spec §10):
 * agreed / total >= 90%, missed Red / manual Red <= 5%, false Red / Red warnings <= 10%.
 */
export function evaluateGates(
	metrics: WeatherRiskEvaluationMetrics
): Record<WeatherRiskEvaluationGateName, WeatherRiskGateResult> {
	const gates = WEATHER_RISK_RELEASE_GATES;
	const agreementPassed =
		metrics.totalCases > 0 &&
		metrics.agreedCases * 100 >= gates.MIN_OVERALL_AGREEMENT_PERCENT * metrics.totalCases;
	const missedPassed =
		metrics.manualRedCases > 0 &&
		metrics.missedRedCases * 100 <= gates.MAX_MISSED_RED_PERCENT * metrics.manualRedCases;
	const falseRedPassed =
		metrics.falseRedCases * 100 <= gates.MAX_FALSE_RED_PERCENT * metrics.automatedRedCases;

	return {
		[WeatherRiskEvaluationGateName.OVERALL_AGREEMENT]: {
			gateName: WeatherRiskEvaluationGateName.OVERALL_AGREEMENT,
			threshold: gates.MIN_OVERALL_AGREEMENT_PERCENT / 100,
			actual: metrics.overallAgreement,
			comparator: ">=",
			passed: agreementPassed,
			unit: "ratio",
		},
		[WeatherRiskEvaluationGateName.MISSED_RED_RATE]: {
			gateName: WeatherRiskEvaluationGateName.MISSED_RED_RATE,
			threshold: gates.MAX_MISSED_RED_PERCENT / 100,
			actual: metrics.missedRedRate,
			comparator: "<=",
			passed: missedPassed,
			unit: "ratio",
		},
		[WeatherRiskEvaluationGateName.FALSE_RED_RATE]: {
			gateName: WeatherRiskEvaluationGateName.FALSE_RED_RATE,
			threshold: gates.MAX_FALSE_RED_PERCENT / 100,
			actual: metrics.falseRedRate,
			comparator: "<=",
			passed: falseRedPassed,
			unit: "ratio",
		},
	};
}

const percent = (value: number | null): string =>
	value === null ? "n/a" : `${Number((value * 100).toFixed(2))}%`;

/** Scores the dataset, measures it and decides PASSED / FAILED / INVALID with plain reasons. */
export function evaluateWeatherRisk(
	dataset: WeatherManualAssessmentDataset,
	rule: WeatherRiskRule
): WeatherRiskEvaluationOutcome {
	const caseResults = scoreDatasetCases(dataset, rule);
	const metrics = computeMetrics(caseResults);
	const gates = evaluateGates(metrics);
	const failureReasons: string[] = [];
	const invalidReasons: string[] = [];

	if (dataset.status !== WeatherManualAssessmentDatasetStatus.APPROVED) {
		invalidReasons.push(
			`Dataset ${dataset.version} is a draft: its labels are not approved, so the result cannot support a release (BR-280, spec §10).`
		);
	}
	if (metrics.totalCases === 0) {
		invalidReasons.push("Dataset has no case to evaluate.");
	}
	if (metrics.manualRedCases === 0) {
		invalidReasons.push(
			"Dataset has no case labelled Red, so the missed Red/high-risk rate cannot be measured (BR-280, AC-3)."
		);
	}

	const agreement = gates[WeatherRiskEvaluationGateName.OVERALL_AGREEMENT];
	if (!agreement.passed && metrics.totalCases > 0) {
		failureReasons.push(
			`Overall agreement ${percent(agreement.actual)} is below the ${percent(agreement.threshold)} release gate (BR-280, AC-5).`
		);
	}
	const missed = gates[WeatherRiskEvaluationGateName.MISSED_RED_RATE];
	if (!missed.passed && metrics.manualRedCases > 0) {
		failureReasons.push(
			`Missed Red/high-risk rate ${percent(missed.actual)} (${metrics.missedRedCases} of ${metrics.manualRedCases}) exceeds the ${percent(missed.threshold)} release gate (BR-280, AC-6).`
		);
	}
	const falseRed = gates[WeatherRiskEvaluationGateName.FALSE_RED_RATE];
	if (!falseRed.passed) {
		failureReasons.push(
			`False Red warning rate ${percent(falseRed.actual)} (${metrics.falseRedCases} of ${metrics.automatedRedCases}) exceeds the ${percent(falseRed.threshold)} release gate (BR-280, AC-7).`
		);
	}

	let overallResult = WeatherRiskEvaluationStatus.PASSED;
	if (invalidReasons.length > 0) overallResult = WeatherRiskEvaluationStatus.INVALID;
	else if (failureReasons.length > 0) overallResult = WeatherRiskEvaluationStatus.FAILED;

	return {
		caseResults,
		metrics,
		gates,
		overallResult,
		failureReasons: [...invalidReasons, ...failureReasons],
	};
}
