import { ConflictException, NotFoundException } from "@nestjs/common";
import type { WeatherRiskRule } from "../weather/entities/weather-risk-rule.entity";
import { datasetHash, findManualAssessmentDataset } from "./datasets";
import { WEATHER_RISK_EVALUATION_CONFIG_VERSION } from "./weather-risk-evaluation.constants";
import { WeatherRiskEvaluationStatus } from "./weather-risk-evaluation.enums";
import type { WeatherRiskEvaluationRepository } from "./weather-risk-evaluation.repository";
import { WeatherRiskEvaluationService } from "./weather-risk-evaluation.service";

const NOW = new Date("2026-11-13T03:00:00.000Z");
const rule = (version: number) =>
	({
		id: `rule-${version}`,
		version,
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
		isActive: version === 3,
	}) as WeatherRiskRule;

function setup() {
	const repository = {
		findActiveRule: jest.fn().mockResolvedValue(rule(3)),
		findRuleByVersion: jest.fn().mockImplementation(async (v: number) => (v <= 3 ? rule(v) : null)),
		saveReport: jest.fn().mockImplementation(async (data) => ({ id: "report-1", ...data })),
		findLatest: jest.fn().mockResolvedValue(null),
		findHistory: jest.fn().mockResolvedValue([]),
		findById: jest.fn().mockResolvedValue(null),
	};
	const service = new WeatherRiskEvaluationService(
		repository as unknown as WeatherRiskEvaluationRepository
	);
	return { service, repository };
}

describe("WeatherRiskEvaluationService (CTMS-099)", () => {
	it("evaluates the newest dataset with the active rule and stores the full context", async () => {
		const { service, repository } = setup();
		const report = await service.runEvaluation("admin-1", {}, NOW);
		const dataset = findManualAssessmentDataset();
		expect(repository.findActiveRule).toHaveBeenCalled();
		expect(report).toMatchObject({
			id: "report-1",
			datasetVersion: dataset?.version,
			datasetHash: dataset ? datasetHash(dataset) : "",
			datasetStatus: "draft",
			configVersion: WEATHER_RISK_EVALUATION_CONFIG_VERSION,
			ruleId: "rule-3",
			ruleVersion: 3,
			evaluatorId: "admin-1",
			evaluatedAt: NOW.toISOString(),
			// The v1 labels are a draft, so the result cannot support a release.
			overallResult: WeatherRiskEvaluationStatus.INVALID,
		});
		expect(report.ruleSnapshot).toMatchObject({ rainfallRedThreshold: 50, yellowMaxScore: 1.2 });
		expect(Object.keys(report.gates)).toEqual([
			"OVERALL_AGREEMENT",
			"MISSED_RED_RATE",
			"FALSE_RED_RATE",
		]);
		expect(report.caseResults).toHaveLength(dataset?.cases.length ?? 0);
		expect(report.metrics.byLevel.red.cases).toBe(20);
	});

	it("evaluates a chosen rule version as its own context", async () => {
		const { service, repository } = setup();
		const report = await service.runEvaluation("admin-1", { ruleVersion: 2 }, NOW);
		expect(repository.findRuleByVersion).toHaveBeenCalledWith(2);
		expect(repository.findActiveRule).not.toHaveBeenCalled();
		expect(report).toMatchObject({ ruleId: "rule-2", ruleVersion: 2 });
	});

	it("rejects an unknown dataset or rule version, and a missing active rule", async () => {
		const { service, repository } = setup();
		await expect(service.runEvaluation("a", { datasetVersion: "v9" }, NOW)).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(service.runEvaluation("a", { ruleVersion: 99 }, NOW)).rejects.toBeInstanceOf(
			NotFoundException
		);
		repository.findActiveRule.mockResolvedValue(null);
		await expect(service.runEvaluation("a", {}, NOW)).rejects.toBeInstanceOf(ConflictException);
		expect(repository.saveReport).not.toHaveBeenCalled();
	});

	it("lists datasets with their hash and per-level counts", () => {
		const [summary] = setup().service.listDatasets();
		expect(summary).toMatchObject({
			status: "draft",
			totalCases: 60,
			boundaryCases: 18,
			casesByLevel: { green: 20, yellow: 20, red: 20 },
		});
		expect(summary.hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("bounds the history size and 404s on a missing report", async () => {
		const { service, repository } = setup();
		await service.getHistory(1000);
		expect(repository.findHistory).toHaveBeenCalledWith(100);
		await service.getHistory(0);
		expect(repository.findHistory).toHaveBeenLastCalledWith(1);
		await expect(service.getLatestReport()).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.getReportById("x")).rejects.toBeInstanceOf(NotFoundException);
	});
});
