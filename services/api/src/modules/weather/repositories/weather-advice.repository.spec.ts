import type { EntityManager } from "typeorm";
import { WeatherAdvice } from "../entities/weather-advice.entity";
import { WeatherAdviceRepository } from "./weather-advice.repository";

describe("WeatherAdviceRepository", () => {
	let repository: WeatherAdviceRepository;

	beforeEach(() => {
		repository = new WeatherAdviceRepository(WeatherAdvice, {} as EntityManager);
	});

	describe("findExistingForAssessment", () => {
		it("calls findOne with the given assessmentId", async () => {
			const mockAdvice = { id: "advice-1" };
			const findOneSpy = jest.spyOn(repository, "findOne").mockResolvedValue(mockAdvice as never);

			const result = await repository.findExistingForAssessment("assessment-1");

			expect(findOneSpy).toHaveBeenCalledWith({ where: { assessmentId: "assessment-1" } });
			expect(result).toEqual(mockAdvice);
		});

		it("returns null when none exists", async () => {
			jest.spyOn(repository, "findOne").mockResolvedValue(null);

			expect(await repository.findExistingForAssessment("assessment-1")).toBeNull();
		});
	});

	describe("createAdvice", () => {
		it("creates and saves a new advice row", async () => {
			const input = {
				assessmentId: "assessment-1",
				adviceText: "Điều kiện ở mức cảnh báo.",
				actions: ["Mang áo mưa"],
				createdBy: "user-1",
			};
			const mockCreated = { ...input, id: "advice-1" };

			const createSpy = jest.spyOn(repository, "create").mockReturnValue(mockCreated as never);
			const saveSpy = jest.spyOn(repository, "save").mockResolvedValue(mockCreated as never);

			const result = await repository.createAdvice(input);

			expect(createSpy).toHaveBeenCalledWith(input);
			expect(saveSpy).toHaveBeenCalledWith(mockCreated);
			expect(result).toEqual(mockCreated);
		});
	});

	describe("findLatestForRoute", () => {
		it("joins to weather_risk_assessments, filters by route_id, and orders by created_at DESC", async () => {
			const mockAdvice = { id: "advice-1" };
			const qb = {
				innerJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(mockAdvice),
			};
			const createQueryBuilderSpy = jest
				.spyOn(repository, "createQueryBuilder")
				.mockReturnValue(qb as never);

			const result = await repository.findLatestForRoute("route-1");

			expect(createQueryBuilderSpy).toHaveBeenCalledWith("advice");
			expect(qb.innerJoin).toHaveBeenCalledWith(
				"weather_risk_assessments",
				"assessment",
				"assessment.id = advice.assessment_id"
			);
			expect(qb.where).toHaveBeenCalledWith("assessment.route_id = :routeId", {
				routeId: "route-1",
			});
			expect(qb.orderBy).toHaveBeenCalledWith("advice.created_at", "DESC");
			expect(result).toEqual(mockAdvice);
		});

		it("returns null when no advice has ever been recorded for the route", async () => {
			const qb = {
				innerJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};
			jest.spyOn(repository, "createQueryBuilder").mockReturnValue(qb as never);

			expect(await repository.findLatestForRoute("route-1")).toBeNull();
		});
	});
});
