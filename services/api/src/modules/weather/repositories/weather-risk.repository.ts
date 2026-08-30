import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { WeatherRiskAssessment } from "../entities/weather-risk-assessment.entity";
import { WeatherRiskRule } from "../entities/weather-risk-rule.entity";

@Injectable()
export class WeatherRiskRepository extends Repository<WeatherRiskAssessment> {
	async findActiveRule(): Promise<WeatherRiskRule | null> {
		return this.manager.getRepository(WeatherRiskRule).findOne({
			where: { isActive: true },
			order: { version: "DESC" },
		});
	}

	async findExistingAssessment(
		snapshotId: string,
		ruleVersionId: string
	): Promise<WeatherRiskAssessment | null> {
		return this.findOne({
			where: { snapshotId, ruleVersionId },
		});
	}

	async createAssessment(data: {
		routeId: string;
		snapshotId: string;
		ruleVersionId: string;
		riskLevel: WeatherRiskAssessment["riskLevel"];
		compositeScore: number;
		criteriaScores: WeatherRiskAssessment["criteriaScores"];
		createdBy: string;
	}): Promise<WeatherRiskAssessment> {
		const assessment = this.create(data);
		return this.save(assessment);
	}

	async findLatestAssessmentForRoute(routeId: string): Promise<WeatherRiskAssessment | null> {
		return this.findOne({
			where: { routeId },
			order: { createdAt: "DESC" },
		});
	}
}
