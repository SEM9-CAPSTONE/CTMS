import type { EntityManager } from "typeorm";
import { RiskLevel, WeatherRiskAssessment } from "../entities/weather-risk-assessment.entity";
import { WeatherRiskRule } from "../entities/weather-risk-rule.entity";
import { WeatherRiskRepository } from "./weather-risk.repository";

describe("WeatherRiskRepository", () => {
	let repository: WeatherRiskRepository;
	let managerMock: {
		getRepository: jest.Mock;
	};
	let ruleRepoMock: {
		findOne: jest.Mock;
	};

	beforeEach(() => {
		ruleRepoMock = {
			findOne: jest.fn(),
		};
		managerMock = {
			getRepository: jest.fn().mockReturnValue(ruleRepoMock),
		};
		repository = new WeatherRiskRepository(
			WeatherRiskAssessment,
			managerMock as unknown as EntityManager
		);
	});

	describe("findActiveRule", () => {
		it("finds the latest active rule ordered by version DESC", async () => {
			const mockRule = { id: "rule-1", isActive: true, version: 1 };
			ruleRepoMock.findOne.mockResolvedValue(mockRule);

			const result = await repository.findActiveRule();

			expect(managerMock.getRepository).toHaveBeenCalledWith(WeatherRiskRule);
			expect(ruleRepoMock.findOne).toHaveBeenCalledWith({
				where: { isActive: true },
				order: { version: "DESC" },
			});
			expect(result).toEqual(mockRule);
		});
	});

	describe("findExistingAssessment", () => {
		it("calls findOne with correct snapshotId and ruleVersionId", async () => {
			const mockAssessment = { id: "assess-1" };
			const findOneSpy = jest
				.spyOn(repository, "findOne")
				.mockResolvedValue(mockAssessment as never);

			const result = await repository.findExistingAssessment("snap-1", "rule-1");

			expect(findOneSpy).toHaveBeenCalledWith({
				where: { snapshotId: "snap-1", ruleVersionId: "rule-1" },
			});
			expect(result).toEqual(mockAssessment);
		});
	});

	describe("createAssessment", () => {
		it("creates and saves a new assessment", async () => {
			const input = {
				routeId: "route-1",
				snapshotId: "snap-1",
				ruleVersionId: "rule-1",
				riskLevel: RiskLevel.GREEN,
				compositeScore: 0.1,
				criteriaScores: {} as never,
				createdBy: "user-1",
			};
			const mockCreated = { ...input, id: "assess-1" };

			const createSpy = jest.spyOn(repository, "create").mockReturnValue(mockCreated as never);
			const saveSpy = jest.spyOn(repository, "save").mockResolvedValue(mockCreated as never);

			const result = await repository.createAssessment(input);

			expect(createSpy).toHaveBeenCalledWith(input);
			expect(saveSpy).toHaveBeenCalledWith(mockCreated);
			expect(result).toEqual(mockCreated);
		});
	});

	describe("findLatestAssessmentForRoute", () => {
		it("finds latest assessment ordered by createdAt DESC", async () => {
			const mockAssessment = { id: "assess-1" };
			const findOneSpy = jest
				.spyOn(repository, "findOne")
				.mockResolvedValue(mockAssessment as never);

			const result = await repository.findLatestAssessmentForRoute("route-1");

			expect(findOneSpy).toHaveBeenCalledWith({
				where: { routeId: "route-1" },
				order: { createdAt: "DESC" },
			});
			expect(result).toEqual(mockAssessment);
		});
	});
});
