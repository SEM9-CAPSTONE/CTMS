import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import type { CreateWeatherRiskRuleDto } from "../dto/create-weather-risk-rule.dto";
import type { WeatherRiskRuleResponseDto } from "../dto/weather-risk-rule-response.dto";
import { WeatherRiskRule } from "../entities/weather-risk-rule.entity";

function toRuleResponse(rule: WeatherRiskRule): WeatherRiskRuleResponseDto {
	return {
		id: rule.id,
		version: rule.version,
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
		isActive: rule.isActive,
		createdBy: rule.createdBy,
		createdAt: rule.createdAt,
	};
}

@Injectable()
export class WeatherRiskRulesService {
	private readonly logger = new Logger(WeatherRiskRulesService.name);

	constructor(private readonly dataSource: DataSource) {}

	async findAll(): Promise<WeatherRiskRuleResponseDto[]> {
		const repository = this.dataSource.getRepository(WeatherRiskRule);
		const rules = await repository.find({
			order: { version: "DESC" },
		});
		return rules.map(toRuleResponse);
	}

	async findActive(): Promise<WeatherRiskRuleResponseDto | null> {
		const repository = this.dataSource.getRepository(WeatherRiskRule);
		const activeRule = await repository.findOne({
			where: { isActive: true },
			order: { version: "DESC" },
		});
		return activeRule ? toRuleResponse(activeRule) : null;
	}

	async findById(id: string): Promise<WeatherRiskRuleResponseDto> {
		const repository = this.dataSource.getRepository(WeatherRiskRule);
		const rule = await repository.findOne({ where: { id } });
		if (!rule) {
			throw new NotFoundException(`Weather risk rule version with ID "${id}" not found`);
		}
		return toRuleResponse(rule);
	}

	async createRule(
		actor: AuthenticatedUser,
		dto: CreateWeatherRiskRuleDto
	): Promise<WeatherRiskRuleResponseDto> {
		this.validateWeightsAndThresholds(dto);

		return this.dataSource.transaction(async (manager) => {
			const repo = manager.getRepository(WeatherRiskRule);

			// Determine version increment
			const latest = await repo.findOne({
				where: {},
				order: { version: "DESC" },
			});
			const nextVersion = latest ? latest.version + 1 : 1;

			const shouldActivate = dto.isActive ?? true;

			// If creating an active rule version, deactivate all existing active rules
			if (shouldActivate) {
				await repo.update({ isActive: true }, { isActive: false });
			}

			const rule = repo.create({
				version: nextVersion,
				rainfallYellowThreshold: dto.rainfallYellowThreshold,
				rainfallRedThreshold: dto.rainfallRedThreshold,
				windYellowThreshold: dto.windYellowThreshold,
				windRedThreshold: dto.windRedThreshold,
				tempLowYellow: dto.tempLowYellow,
				tempLowRed: dto.tempLowRed,
				tempHighYellow: dto.tempHighYellow,
				tempHighRed: dto.tempHighRed,
				visibilityYellowThreshold: dto.visibilityYellowThreshold,
				visibilityRedThreshold: dto.visibilityRedThreshold,
				thunderstormYellow: dto.thunderstormYellow,
				thunderstormRed: dto.thunderstormRed,
				rainfallWeight: dto.rainfallWeight,
				windWeight: dto.windWeight,
				temperatureWeight: dto.temperatureWeight,
				visibilityWeight: dto.visibilityWeight,
				thunderstormWeight: dto.thunderstormWeight,
				greenMaxScore: dto.greenMaxScore,
				yellowMaxScore: dto.yellowMaxScore,
				isActive: shouldActivate,
				createdBy: actor.userId,
			});

			const saved = await repo.save(rule);
			this.logger.log(
				`Created weather risk rule version ${saved.version} (ID: ${saved.id}, Active: ${saved.isActive}) by ${actor.userId}`
			);

			return toRuleResponse(saved);
		});
	}

	async activateRule(
		actor: AuthenticatedUser,
		ruleId: string
	): Promise<WeatherRiskRuleResponseDto> {
		return this.dataSource.transaction(async (manager) => {
			const repo = manager.getRepository(WeatherRiskRule);
			const targetRule = await repo.findOne({ where: { id: ruleId } });
			if (!targetRule) {
				throw new NotFoundException(`Weather risk rule version with ID "${ruleId}" not found`);
			}

			// Deactivate current active rules
			await repo.update({ isActive: true }, { isActive: false });

			// Activate target rule
			targetRule.isActive = true;
			const updated = await repo.save(targetRule);

			this.logger.log(
				`Activated weather risk rule version ${updated.version} (ID: ${updated.id}) by ${actor.userId}`
			);

			return toRuleResponse(updated);
		});
	}

	private validateWeightsAndThresholds(dto: CreateWeatherRiskRuleDto): void {
		// Validate sum of weights = 1.0 (allow 0.001 float precision margin)
		const totalWeight =
			dto.rainfallWeight +
			dto.windWeight +
			dto.temperatureWeight +
			dto.visibilityWeight +
			dto.thunderstormWeight;
		if (Math.abs(totalWeight - 1.0) > 0.001) {
			throw new BadRequestException(
				`Criteria weights must sum up to 1.0 (current sum: ${Number(totalWeight.toFixed(4))})`
			);
		}

		// Validate thresholds
		if (dto.rainfallYellowThreshold >= dto.rainfallRedThreshold) {
			throw new BadRequestException(
				"rainfallYellowThreshold must be strictly less than rainfallRedThreshold"
			);
		}
		if (dto.windYellowThreshold >= dto.windRedThreshold) {
			throw new BadRequestException(
				"windYellowThreshold must be strictly less than windRedThreshold"
			);
		}
		if (dto.visibilityYellowThreshold <= dto.visibilityRedThreshold) {
			throw new BadRequestException(
				"visibilityYellowThreshold must be strictly greater than visibilityRedThreshold"
			);
		}
		if (
			!(
				dto.tempLowRed < dto.tempLowYellow &&
				dto.tempLowYellow < dto.tempHighYellow &&
				dto.tempHighYellow < dto.tempHighRed
			)
		) {
			throw new BadRequestException(
				"Temperature thresholds must satisfy: tempLowRed < tempLowYellow < tempHighYellow < tempHighRed"
			);
		}
		if (dto.greenMaxScore >= dto.yellowMaxScore) {
			throw new BadRequestException("greenMaxScore must be strictly less than yellowMaxScore");
		}
	}
}
