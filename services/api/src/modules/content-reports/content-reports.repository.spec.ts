import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { ContentReportsRepository } from "./content-reports.repository";
import { ContentReport } from "./entities/content-report.entity";

describe("ContentReportsRepository.findForUpdate", () => {
	it("locks only the requested report row without joining target tables", async () => {
		const query = {
			setLock: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(null),
		};
		const repository = new ContentReportsRepository(ContentReport, {} as EntityManager);
		jest
			.spyOn(repository, "createQueryBuilder")
			.mockReturnValue(query as unknown as SelectQueryBuilder<ContentReport>);
		await expect(repository.findForUpdate("report-id")).resolves.toBeNull();
		expect(query.setLock).toHaveBeenCalledWith("pessimistic_write");
		expect(query.where).toHaveBeenCalledWith("report.id = :id", { id: "report-id" });
	});
});
