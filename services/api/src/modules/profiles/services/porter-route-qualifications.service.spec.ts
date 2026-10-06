import { ConflictException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { QueryFailedError } from "typeorm";
import type { TrekkingRoutesRepository } from "../../trekking-routes/repositories/trekking-routes.repository";
import type { UsersRepository } from "../../users/users.repository";
import type { PorterProfilesRepository } from "../repositories/porter-profiles.repository";
import type { PorterRouteQualificationsRepository } from "../repositories/porter-route-qualifications.repository";
import { PorterRouteQualificationsService } from "./porter-route-qualifications.service";

const PORTER_ID = "11111111-1111-1111-1111-111111111111";
const ROUTE_ID = "22222222-2222-2222-2222-222222222222";

describe("PorterRouteQualificationsService", () => {
	function buildService(transactionError?: unknown): {
		service: PorterRouteQualificationsService;
		qualificationsRepository: { findOneBy: jest.Mock; isVerifiedLeadQualified: jest.Mock };
	} {
		const qualificationsRepository = {
			findOneBy: jest.fn().mockResolvedValue(null),
			isVerifiedLeadQualified: jest.fn(),
		};
		const dataSource = {
			transaction: jest.fn().mockRejectedValue(transactionError),
		};
		return {
			service: new PorterRouteQualificationsService(
				qualificationsRepository as unknown as PorterRouteQualificationsRepository,
				{} as PorterProfilesRepository,
				{} as TrekkingRoutesRepository,
				{} as UsersRepository,
				dataSource as unknown as DataSource
			),
			qualificationsRepository,
		};
	}

	it("maps only the approved named unique constraint to ConflictException", async () => {
		const driverError = Object.assign(new Error("duplicate"), {
			code: "23505",
			constraint: "UQ_porter_route_qualifications_porter_route",
		});
		const { service } = buildService(new QueryFailedError("INSERT", [], driverError));

		await expect(
			service.upsertMine(PORTER_ID, ROUTE_ID, { proficiency: "proficient" as never, timesLed: 1 })
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("does not remap an unrelated 23505 constraint", async () => {
		const driverError = Object.assign(new Error("duplicate"), {
			code: "23505",
			constraint: "UQ_unrelated",
		});
		const queryError = new QueryFailedError("INSERT", [], driverError);
		const { service } = buildService(queryError);

		await expect(
			service.upsertMine(PORTER_ID, ROUTE_ID, { proficiency: "proficient" as never, timesLed: 1 })
		).rejects.toBe(queryError);
	});

	it("passes an optional EntityManager to the transaction-compatible lead helper", async () => {
		const { service, qualificationsRepository } = buildService();
		const manager = {} as EntityManager;
		qualificationsRepository.isVerifiedLeadQualified.mockResolvedValue(true);

		await expect(service.isLeadEligible(PORTER_ID, ROUTE_ID, manager)).resolves.toBe(true);
		expect(qualificationsRepository.isVerifiedLeadQualified).toHaveBeenCalledWith(
			PORTER_ID,
			ROUTE_ID,
			manager
		);
	});
});
