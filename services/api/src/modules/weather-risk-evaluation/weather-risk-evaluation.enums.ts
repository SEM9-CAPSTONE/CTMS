export enum WeatherRiskEvaluationStatus {
	/** Every V3 release gate is met on an approved dataset. */
	PASSED = "PASSED",
	/** At least one release gate is not met. */
	FAILED = "FAILED",
	/** The evidence cannot support a release decision (draft dataset, no Red case...). */
	INVALID = "INVALID",
}

export enum WeatherRiskEvaluationGateName {
	OVERALL_AGREEMENT = "OVERALL_AGREEMENT",
	MISSED_RED_RATE = "MISSED_RED_RATE",
	FALSE_RED_RATE = "FALSE_RED_RATE",
}

export enum WeatherManualAssessmentDatasetStatus {
	/** Labels not yet confirmed by an approved evaluator; reports on it are INVALID. */
	DRAFT = "draft",
	APPROVED = "approved",
}
