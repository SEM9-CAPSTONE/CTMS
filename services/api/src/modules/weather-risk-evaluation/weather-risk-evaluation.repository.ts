import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type Repository } from "typeorm";
import { WeatherRiskRule } from "../weather/entities/weather-risk-rule.entity";
import { WeatherRiskEvaluationReportEntity } from "./entities/weather-risk-evaluation-report.entity";

@Injectable()
export class WeatherRiskEvaluationRepository {
	private readonly reports: Repository<WeatherRiskEvaluationReportEntity>;
	private readonly rules: Repository<WeatherRiskRule>;

	constructor(private readonly dataSource: DataSource) {
		this.reports = this.dataSource.getRepository(WeatherRiskEvaluationReportEntity);
		this.rules = this.dataSource.getRepository(WeatherRiskRule);
	}

	/** Read-only: the evaluation never changes a rule (spec §2 Out of Scope). */
	async findActiveRule(): Promise<WeatherRiskRule | null> {
		return this.rules.findOne({ where: { isActive: true }, order: { version: "DESC" } });
	}

	async findRuleByVersion(version: number): Promise<WeatherRiskRule | null> {
		return this.rules.findOne({ where: { version } });
	}

	async saveReport(
		data: Partial<WeatherRiskEvaluationReportEntity>
	): Promise<WeatherRiskEvaluationReportEntity> {
		return this.reports.save(this.reports.create(data));
	}

	async findLatest(): Promise<WeatherRiskEvaluationReportEntity | null> {
		return this.reports.findOne({ where: {}, order: { evaluatedAt: "DESC", id: "DESC" } });
	}

	async findHistory(limit: number): Promise<WeatherRiskEvaluationReportEntity[]> {
		return this.reports.find({ order: { evaluatedAt: "DESC", id: "DESC" }, take: limit });
	}

	async findById(id: string): Promise<WeatherRiskEvaluationReportEntity | null> {
		return this.reports.findOne({ where: { id } });
	}
}
