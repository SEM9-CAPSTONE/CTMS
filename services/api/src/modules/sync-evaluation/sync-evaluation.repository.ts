import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type Repository } from "typeorm";
import { SyncEvaluationReportEntity } from "./entities/sync-evaluation-report.entity";

@Injectable()
export class SyncEvaluationRepository {
	private readonly repo: Repository<SyncEvaluationReportEntity>;

	constructor(private readonly dataSource: DataSource) {
		this.repo = this.dataSource.getRepository(SyncEvaluationReportEntity);
	}

	async saveReport(data: Partial<SyncEvaluationReportEntity>): Promise<SyncEvaluationReportEntity> {
		const entity = this.repo.create(data);
		return this.repo.save(entity);
	}

	async findLatest(): Promise<SyncEvaluationReportEntity | null> {
		return this.repo.findOne({
			order: { evaluatedAt: "DESC" },
		});
	}

	async findHistory(limit = 20): Promise<SyncEvaluationReportEntity[]> {
		return this.repo.find({
			order: { evaluatedAt: "DESC" },
			take: limit,
		});
	}

	async findById(id: string): Promise<SyncEvaluationReportEntity | null> {
		return this.repo.findOne({
			where: { id },
		});
	}
}
