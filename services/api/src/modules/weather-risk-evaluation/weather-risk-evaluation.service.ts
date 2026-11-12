import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { RiskLevel } from "../weather/entities/weather-risk-assessment.entity";
import type { WeatherRiskRule } from "../weather/entities/weather-risk-rule.entity";
import {
	WEATHER_MANUAL_ASSESSMENT_DATASETS,
	type WeatherManualAssessmentDataset,
	datasetHash,
	findManualAssessmentDataset,
} from "./datasets";
import {
	type RunWeatherRiskEvaluationDto,
	type WeatherManualAssessmentDatasetSummaryDto,
	type WeatherRiskEvaluationReportResponseDto,
	toWeatherRiskEvaluationReportDto,
} from "./dto/weather-risk-evaluation.dto";
import type { WeatherRuleSnapshot } from "./entities/weather-risk-evaluation-report.entity";
import {
	WEATHER_RISK_EVALUATION_CONFIG_VERSION,
	WEATHER_RISK_EVALUATION_HISTORY_LIMIT,
	WEATHER_RISK_EVALUATION_MAX_HISTORY_LIMIT,
} from "./weather-risk-evaluation.constants";
import { evaluateWeatherRisk } from "./weather-risk-evaluation.metrics";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherRiskEvaluationRepository } from "./weather-risk-evaluation.repository";

/**
 * CTMS-099: compares the Weather Risk scorer with a versioned manual-assessment set and keeps the
 * report (BR-280, BR-282). Reads the rule; never changes it.
 */
@Injectable()
export class WeatherRiskEvaluationService {
	constructor(private readonly repository: WeatherRiskEvaluationRepository) {}

	async runEvaluation(
		evaluatorId: string,
		dto: RunWeatherRiskEvaluationDto,
		now = new Date()
	): Promise<WeatherRiskEvaluationReportResponseDto> {
		const dataset = findManualAssessmentDataset(dto.datasetVersion);
		if (!dataset) {
			throw new NotFoundException(`Manual-assessment dataset ${dto.datasetVersion} not found`);
		}
		const rule = await this.resolveRule(dto.ruleVersion);
		const outcome = evaluateWeatherRisk(dataset, rule);

		const saved = await this.repository.saveReport({
			datasetVersion: dataset.version,
			datasetHash: datasetHash(dataset),
			datasetStatus: dataset.status,
			configVersion: WEATHER_RISK_EVALUATION_CONFIG_VERSION,
			ruleId: rule.id,
			ruleVersion: rule.version,
			ruleSnapshot: ruleSnapshot(rule),
			overallResult: outcome.overallResult,
			evaluatedAt: now,
			gates: outcome.gates,
			metrics: outcome.metrics,
			caseResults: outcome.caseResults,
			failureReasons: outcome.failureReasons,
			evaluatorId,
		});
		return toWeatherRiskEvaluationReportDto(saved);
	}

	async getLatestReport(): Promise<WeatherRiskEvaluationReportResponseDto> {
		const report = await this.repository.findLatest();
		if (!report) throw new NotFoundException("No Weather Risk evaluation report yet");
		return toWeatherRiskEvaluationReportDto(report);
	}

	async getHistory(
		limit = WEATHER_RISK_EVALUATION_HISTORY_LIMIT
	): Promise<WeatherRiskEvaluationReportResponseDto[]> {
		const bounded = Math.min(
			Math.max(Math.trunc(limit), 1),
			WEATHER_RISK_EVALUATION_MAX_HISTORY_LIMIT
		);
		const reports = await this.repository.findHistory(bounded);
		return reports.map(toWeatherRiskEvaluationReportDto);
	}

	async getReportById(id: string): Promise<WeatherRiskEvaluationReportResponseDto> {
		const report = await this.repository.findById(id);
		if (!report) throw new NotFoundException("Weather Risk evaluation report not found");
		return toWeatherRiskEvaluationReportDto(report);
	}

	listDatasets(): WeatherManualAssessmentDatasetSummaryDto[] {
		return WEATHER_MANUAL_ASSESSMENT_DATASETS.map(summarizeDataset);
	}

	private async resolveRule(version?: number): Promise<WeatherRiskRule> {
		if (version !== undefined) {
			const rule = await this.repository.findRuleByVersion(version);
			if (!rule) throw new NotFoundException(`Weather Risk rule version ${version} not found`);
			return rule;
		}
		const active = await this.repository.findActiveRule();
		if (!active) throw new ConflictException("No active Weather Risk rule to evaluate");
		return active;
	}
}

function summarizeDataset(
	dataset: WeatherManualAssessmentDataset
): WeatherManualAssessmentDatasetSummaryDto {
	const count = (level: RiskLevel) =>
		dataset.cases.filter((testCase) => testCase.manualLevel === level).length;
	return {
		version: dataset.version,
		status: dataset.status,
		description: dataset.description,
		approvedBy: dataset.approvedBy,
		approvedAt: dataset.approvedAt,
		hash: datasetHash(dataset),
		totalCases: dataset.cases.length,
		boundaryCases: dataset.cases.filter((testCase) => testCase.boundary).length,
		casesByLevel: {
			[RiskLevel.GREEN]: count(RiskLevel.GREEN),
			[RiskLevel.YELLOW]: count(RiskLevel.YELLOW),
			[RiskLevel.RED]: count(RiskLevel.RED),
		},
	};
}

/** The parts of the rule that decide a level, frozen into the report (BR-282 traceability). */
function ruleSnapshot(rule: WeatherRiskRule): WeatherRuleSnapshot {
	return {
		rainfallYellowThreshold: rule.rainfallYellowThreshold,
		rainfallRedThreshold: rule.rainfallRedThreshold,
		windYellowThreshold: rule.windYellowThreshold,
		windRedThreshold: rule.windRedThreshold,
		tempLowYellow: rule.tempLowYellow,
		tempLowRed: rule.tempLowRed,
		tempHighYellow: rule.tempHighYellow,
		tempHighRed: rule.tempHighRed,
		visibilityYellowThreshold: rule.visibilityYellowThreshold,
		visibilityRedThreshold: rule.visibilityRedThreshold,
		thunderstormYellow: rule.thunderstormYellow,
		thunderstormRed: rule.thunderstormRed,
		rainfallWeight: rule.rainfallWeight,
		windWeight: rule.windWeight,
		temperatureWeight: rule.temperatureWeight,
		visibilityWeight: rule.visibilityWeight,
		thunderstormWeight: rule.thunderstormWeight,
		greenMaxScore: rule.greenMaxScore,
		yellowMaxScore: rule.yellowMaxScore,
	};
}
