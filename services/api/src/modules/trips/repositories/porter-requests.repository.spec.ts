import type { EntityManager } from "typeorm";
import { PorterRequest, PorterRequestStatus } from "../entities/porter-request.entity";
import { PorterRequestsRepository } from "./porter-requests.repository";

describe("PorterRequestsRepository expiry results", () => {
	it.each([false, true])("normalizes expired rows with TypeORM tuple=%s", async (tuple) => {
		const repository = new PorterRequestsRepository(PorterRequest, {} as EntityManager);
		const rows = [{ id: "expired", status: PorterRequestStatus.EXPIRED }];
		jest.spyOn(repository, "query").mockResolvedValue(tuple ? [rows, 1] : rows);
		expect(await repository.expirePendingBatch(100)).toEqual(rows);
	});
	it("returns every expired request for the requested Porter without a batch limit", async () => {
		const repository = new PorterRequestsRepository(PorterRequest, {} as EntityManager);
		const rows = Array.from({ length: 101 }, (_, id) => ({ id: String(id) }));
		const query = jest.spyOn(repository, "query").mockResolvedValue([rows, rows.length]);
		expect(await repository.expirePendingByPorter("porter")).toHaveLength(101);
		expect(query).toHaveBeenCalledWith(expect.any(String), [
			PorterRequestStatus.EXPIRED,
			PorterRequestStatus.PENDING,
			null,
			"porter",
		]);
	});
});
