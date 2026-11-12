import type { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import type { WeatherScoringInput } from "../../weather/services/weather-risk-scoring";
import type { WeatherManualAssessmentDatasetStatus } from "../weather-risk-evaluation.enums";

/** One labelled case: the worst hourly reading of a trekking day and the evaluator's level. */
export interface WeatherManualAssessmentCase {
	/** Stable id inside the dataset version, e.g. "G01". */
	id: string;
	readings: WeatherScoringInput;
	manualLevel: RiskLevel;
	/** Near a threshold; reported separately and never gates the release on its own. */
	boundary: boolean;
	note: string;
}

/**
 * A versioned manual-assessment set (BR-280). A published version is never edited: new labels
 * mean a new version. The SHA-256 of the dataset is stored on every report.
 */
export interface WeatherManualAssessmentDataset {
	version: string;
	status: WeatherManualAssessmentDatasetStatus;
	description: string;
	/** Who confirmed the labels and when; both null while the dataset is a draft. */
	approvedBy: string | null;
	approvedAt: string | null;
	cases: WeatherManualAssessmentCase[];
}
