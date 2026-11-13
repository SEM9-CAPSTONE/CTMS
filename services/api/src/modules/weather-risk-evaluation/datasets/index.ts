import { createHash } from "node:crypto";
import type { WeatherManualAssessmentDataset } from "./manual-assessment.types";
import { WEATHER_MANUAL_ASSESSMENT_V1 } from "./manual-assessment.v1";

/** Every published manual-assessment version, oldest first; the last one is the default. */
export const WEATHER_MANUAL_ASSESSMENT_DATASETS: readonly WeatherManualAssessmentDataset[] = [
	WEATHER_MANUAL_ASSESSMENT_V1,
];

export function findManualAssessmentDataset(
	version?: string
): WeatherManualAssessmentDataset | null {
	if (version === undefined) return WEATHER_MANUAL_ASSESSMENT_DATASETS.at(-1) ?? null;
	return WEATHER_MANUAL_ASSESSMENT_DATASETS.find((dataset) => dataset.version === version) ?? null;
}

/** SHA-256 of the dataset as written (`JSON.stringify`); any change to a case changes it. */
export function datasetHash(dataset: WeatherManualAssessmentDataset): string {
	return createHash("sha256").update(JSON.stringify(dataset)).digest("hex");
}

export type {
	WeatherManualAssessmentCase,
	WeatherManualAssessmentDataset,
} from "./manual-assessment.types";
