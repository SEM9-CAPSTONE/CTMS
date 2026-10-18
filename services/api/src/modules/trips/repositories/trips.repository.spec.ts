import type { EntityManager } from "typeorm";
import { TripReviewOutcome } from "../dto/list-trip-reviews-query.dto";
import { Trip } from "../entities/trip.entity";
import { TripsRepository } from "./trips.repository";

describe("TripsRepository Admin review outcomes", () => {
	it.each(Object.values(TripReviewOutcome))(
		"filters by %s with correct count and stable ordering",
		async (reviewOutcome) => {
			const repository = new TripsRepository(Trip, {} as EntityManager);
			const query = jest
				.spyOn(repository, "query")
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ total: "0" }]);

			await expect(repository.findAdminReviews(reviewOutcome, 3, 5)).resolves.toEqual({
				items: [],
				total: 0,
			});
			expect(query.mock.calls[0][1]).toEqual([reviewOutcome, 5, 10]);
			const sql = query.mock.calls[0][0] as string;
			expect(sql).toContain('trip."id" ASC');
			expect(sql).toContain("trip.approved");
			expect(sql).toContain("trip.declined");
			expect(sql).toContain("trip.auto_rejected");
			expect(sql).toContain(`trip."status" = 'draft'`);
			expect(sql).toContain(`trip."status" = 'rejected'`);
			expect(sql).toContain("trip.submitted_for_approval");
		}
	);

	it("distinguishes latest manual, approved, pending, and BR-222 outcomes", async () => {
		const repository = new TripsRepository(Trip, {} as EntityManager);
		const query = jest
			.spyOn(repository, "query")
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: "0" }]);

		await repository.findAdminReviews(TripReviewOutcome.ALL, 1, 20);
		const sql = query.mock.calls[0][0] as string;
		const pendingRule = sql.indexOf(`trip."status" = 'pending_approval'`);
		const approvedRule = sql.indexOf(`latest_review."action" = 'trip.approved'`);

		expect(pendingRule).toBeGreaterThan(-1);
		expect(pendingRule).toBeLessThan(approvedRule);
		expect(sql).toContain(`trip."status" = 'draft'`);
		expect(sql).toContain(`latest_review."action" = 'trip.declined'`);
		expect(sql).toContain(`trip."status" = 'rejected'`);
		expect(sql).toContain(`latest_review."action" = 'trip.auto_rejected'`);
		expect(sql).toContain("trip.submitted_for_approval");
		expect(sql).toContain('ORDER BY audit."created_at" DESC, audit."id" DESC');
		expect(sql).toContain("LIMIT 1");
		expect(sql).not.toContain(`trip."status" = 'published' THEN 'approved'`);
		expect(sql).not.toContain(`trip."status" = 'cancelled' THEN 'approved'`);
	});

	it("keeps the legacy pending-review query unpaginated", async () => {
		const repository = new TripsRepository(Trip, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([]);

		await expect(repository.findPendingReview()).resolves.toEqual([]);
		expect(query).toHaveBeenCalledTimes(1);
		expect(query.mock.calls[0][0]).toContain('WHERE trip."status" = $1');
	});
});
