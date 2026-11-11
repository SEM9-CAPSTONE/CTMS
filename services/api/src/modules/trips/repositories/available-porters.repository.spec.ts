import type { EntityManager } from "typeorm";
import {
	PorterAvailabilityStatus,
	PorterProfile,
} from "../../profiles/entities/porter-profile.entity";
import { PorterRouteProficiency } from "../../profiles/entities/porter-route-qualification.entity";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import { IntendedPorterRole } from "../dto/available-porters-query.dto";
import { AvailablePortersRepository } from "./available-porters.repository";

const ROUTE_ID = "11111111-1111-4111-8111-111111111111";
const CONFLICTING_PORTER_ID = "22222222-2222-4222-8222-222222222222";

describe("AvailablePortersRepository", () => {
	it("filters support candidates, paginates deterministically, and maps only operational fields", async () => {
		const repository = new AvailablePortersRepository(PorterProfile, {} as EntityManager);
		const query = jest
			.spyOn(repository, "query")
			.mockResolvedValueOnce([{ total: "3" }])
			.mockResolvedValueOnce([
				{
					porterId: "33333333-3333-4333-8333-333333333333",
					displayName: "Porter A",
					experienceYears: "4",
					availabilityStatus: PorterAvailabilityStatus.AVAILABLE,
					ratingAvg: "4.75",
					completedTrips: "18",
					proficiency: null,
				},
			]);

		const result = await repository.findEligibleCandidates({
			routeId: ROUTE_ID,
			role: IntendedPorterRole.SUPPORT,
			minExperienceYears: 2,
			excludedPorterIds: [CONFLICTING_PORTER_ID],
			page: 2,
			limit: 2,
		});

		const countSql = query.mock.calls[0][0].replace(/\s+/g, " ");
		const listSql = query.mock.calls[1][0].replace(/\s+/g, " ");
		expect(countSql).toContain('candidate."status" = $1');
		expect(countSql).toContain('granted_role."role" = $2');
		expect(countSql).toContain('profile."availability_status" = $3');
		expect(countSql).toContain('profile."experience_years" >= $4');
		expect(countSql).toContain('NOT (profile."porter_id" = ANY($5::uuid[]))');
		expect(listSql).toContain('ORDER BY profile."porter_id" ASC');
		expect(listSql).toContain("LIMIT $7 OFFSET $8");
		expect(query.mock.calls[0][1]).toEqual([
			UserStatus.ACTIVE,
			UserRole.PORTER,
			PorterAvailabilityStatus.AVAILABLE,
			2,
			[CONFLICTING_PORTER_ID],
			ROUTE_ID,
		]);
		expect(query.mock.calls[1][1]).toEqual([
			UserStatus.ACTIVE,
			UserRole.PORTER,
			PorterAvailabilityStatus.AVAILABLE,
			2,
			[CONFLICTING_PORTER_ID],
			ROUTE_ID,
			2,
			2,
		]);
		expect(result).toEqual({
			items: [
				{
					porterId: "33333333-3333-4333-8333-333333333333",
					displayName: "Porter A",
					experienceYears: 4,
					availabilityStatus: PorterAvailabilityStatus.AVAILABLE,
					ratingAvg: 4.75,
					completedTrips: 18,
				},
			],
			total: 3,
		});
		expect(result.items[0]).not.toHaveProperty("email");
		expect(result.items[0]).not.toHaveProperty("phone");
	});

	it("requires an exact verified proficient or expert qualification for lead candidates", async () => {
		const repository = new AvailablePortersRepository(PorterProfile, {} as EntityManager);
		const query = jest
			.spyOn(repository, "query")
			.mockResolvedValueOnce([{ total: 1 }])
			.mockResolvedValueOnce([
				{
					porterId: "44444444-4444-4444-8444-444444444444",
					displayName: "Lead Porter",
					experienceYears: 8,
					availabilityStatus: PorterAvailabilityStatus.AVAILABLE,
					ratingAvg: 4.9,
					completedTrips: 61,
					proficiency: PorterRouteProficiency.EXPERT,
				},
			]);

		const result = await repository.findEligibleCandidates({
			routeId: ROUTE_ID,
			role: IntendedPorterRole.LEAD,
			excludedPorterIds: [],
			page: 1,
			limit: 20,
		});

		const sql = query.mock.calls[0][0].replace(/\s+/g, " ");
		expect(sql).toContain('qualification."proficiency" = ANY($5::porter_route_proficiency[])');
		expect(sql).toContain('qualification."verified_by" IS NOT NULL');
		expect(sql).toContain('qualification."verified_at" IS NOT NULL');
		expect(query.mock.calls[0][1]).toEqual([
			UserStatus.ACTIVE,
			UserRole.PORTER,
			PorterAvailabilityStatus.AVAILABLE,
			ROUTE_ID,
			[PorterRouteProficiency.PROFICIENT, PorterRouteProficiency.EXPERT],
		]);
		expect(result.items[0]?.proficiency).toBe(PorterRouteProficiency.EXPERT);
	});
});
