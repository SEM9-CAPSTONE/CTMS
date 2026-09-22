import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { ContentReport } from "./entities/content-report.entity";

@Injectable()
export class ContentReportsRepository extends Repository<ContentReport> {
	findForUpdate(id: string): Promise<ContentReport | null> {
		return this.createQueryBuilder("report")
			.setLock("pessimistic_write")
			.where("report.id = :id", { id })
			.getOne();
	}
}
