import type { EntityManager } from "typeorm";
import { PorterProfile } from "../entities/porter-profile.entity";
import { PorterProfilesRepository } from "./porter-profiles.repository";

describe("PorterProfilesRepository.findLedTripHistory", () => {
	it("uses completed assigned Trips with an accepted Lead request and deterministic pagination", async () => {
		const query = jest.fn().mockResolvedValue([
			{
				tripId: "trip-2",
				tripTitle: "Đỉnh Langbiang",
				routeId: "route-2",
				routeName: "Tuyến Langbiang",
				startsAt: new Date("2026-05-02T00:00:00.000Z"),
				endsAt: new Date("2026-05-03T00:00:00.000Z"),
				role: "lead",
				status: "completed",
				total: "6",
			},
		]);
		const repository = new PorterProfilesRepository(PorterProfile, {
			query,
		} as unknown as EntityManager);

		const result = await repository.findLedTripHistory("porter-1", 2, 5);

		expect(result.total).toBe(6);
		expect(result.items).toEqual([
			expect.objectContaining({ tripId: "trip-2", role: "lead", status: "completed" }),
		]);
		const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
		expect(sql).toContain('assignment."status"::text = $6');
		expect(sql).toContain('trip."status"::text = $5');
		expect(sql).toContain('request."requested_role"::text = $4');
		expect(sql).toContain('request."status"::text = $7');
		expect(sql).toContain('ORDER BY "endsAt" DESC, "tripId" ASC');
		expect(parameters).toEqual(["porter-1", 5, 5, "lead", "completed", "assigned", "accepted"]);
	});

	it("returns an accurate count when the requested page has no rows", async () => {
		const query = jest.fn().mockResolvedValue([{ total: "3" }]);
		const repository = new PorterProfilesRepository(PorterProfile, {
			query,
		} as unknown as EntityManager);

		await expect(repository.findLedTripHistory("porter-1", 4, 5)).resolves.toEqual({
			items: [],
			total: 3,
		});
	});
});
