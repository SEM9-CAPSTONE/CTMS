import type { EntityManager, SelectQueryBuilder } from "typeorm";
import {
	PorterRouteProficiency,
	PorterRouteQualification,
} from "../entities/porter-route-qualification.entity";
import { PorterRouteQualificationsRepository } from "./porter-route-qualifications.repository";

describe("PorterRouteQualificationsRepository", () => {
	it("locks the exact Porter/Route qualification for mutation", async () => {
		const query = {
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			setLock: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(null),
		};
		const repository = new PorterRouteQualificationsRepository(
			PorterRouteQualification,
			{} as EntityManager
		);
		jest
			.spyOn(repository, "createQueryBuilder")
			.mockReturnValue(query as unknown as SelectQueryBuilder<PorterRouteQualification>);

		await repository.findByPorterAndRouteForUpdate("porter-1", "route-1");

		expect(query.setLock).toHaveBeenCalledWith("pessimistic_write");
		expect(query.where).toHaveBeenCalledWith("qualification.porterId = :porterId", {
			porterId: "porter-1",
		});
		expect(query.andWhere).toHaveBeenCalledWith("qualification.routeId = :routeId", {
			routeId: "route-1",
		});
	});

	it("requires verified proficient or expert proficiency for lead eligibility", async () => {
		const query = {
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getExists: jest.fn().mockResolvedValue(true),
		};
		const repository = new PorterRouteQualificationsRepository(
			PorterRouteQualification,
			{} as EntityManager
		);
		jest
			.spyOn(repository, "createQueryBuilder")
			.mockReturnValue(query as unknown as SelectQueryBuilder<PorterRouteQualification>);

		await expect(repository.isVerifiedLeadQualified("porter-1", "route-1")).resolves.toBe(true);

		expect(query.andWhere).toHaveBeenCalledWith(
			"qualification.proficiency IN (:...proficiencies)",
			{
				proficiencies: [PorterRouteProficiency.PROFICIENT, PorterRouteProficiency.EXPERT],
			}
		);
		expect(query.andWhere).toHaveBeenCalledWith("qualification.verifiedBy IS NOT NULL");
		expect(query.andWhere).toHaveBeenCalledWith("qualification.verifiedAt IS NOT NULL");
	});
});
