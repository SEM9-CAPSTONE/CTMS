import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { WeatherAdvice } from "../entities/weather-advice.entity";

@Injectable()
export class WeatherAdviceRepository extends Repository<WeatherAdvice> {
	async findExistingForAssessment(assessmentId: string): Promise<WeatherAdvice | null> {
		return this.findOne({ where: { assessmentId } });
	}

	async createAdvice(data: {
		assessmentId: string;
		adviceText: string;
		actions: string[];
		createdBy: string;
	}): Promise<WeatherAdvice> {
		const advice = this.create(data);
		return this.save(advice);
	}

	async findLatestForRoute(routeId: string): Promise<WeatherAdvice | null> {
		return this.createQueryBuilder("advice")
			.innerJoin("weather_risk_assessments", "assessment", "assessment.id = advice.assessment_id")
			.where("assessment.route_id = :routeId", { routeId })
			.orderBy("advice.created_at", "DESC")
			.getOne();
	}
}
