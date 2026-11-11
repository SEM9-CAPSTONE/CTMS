import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { ListContentReportsQueryDto } from "./dto/list-content-reports-query.dto";
import type { ContentReport } from "./entities/content-report.entity";

@Injectable()
export class ContentReportsRepository extends Repository<ContentReport> {
	findQueue({ page, limit }: ListContentReportsQueryDto): Promise<[ContentReport[], number]> {
		return this.createQueryBuilder("report")
			.innerJoin("report.reporter", "reporter")
			.addSelect(["reporter.id", "reporter.fullName"])
			.orderBy("report.createdAt", "DESC")
			.addOrderBy("report.id", "DESC")
			.skip((page - 1) * limit)
			.take(limit)
			.getManyAndCount();
	}

	findForUpdate(id: string): Promise<ContentReport | null> {
		return this.createQueryBuilder("report")
			.setLock("pessimistic_write")
			.where("report.id = :id", { id })
			.getOne();
	}
}
