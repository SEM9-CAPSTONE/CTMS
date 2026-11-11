import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type Repository } from "typeorm";
import { OverbookingEvaluationReportEntity } from "./entities/overbooking-evaluation-report.entity";

@Injectable()
export class OverbookingEvaluationRepository {
	private readonly repo: Repository<OverbookingEvaluationReportEntity>;

	constructor(private readonly dataSource: DataSource) {
		this.repo = this.dataSource.getRepository(OverbookingEvaluationReportEntity);
	}

	async saveReport(
		data: Partial<OverbookingEvaluationReportEntity>
	): Promise<OverbookingEvaluationReportEntity> {
		const entity = this.repo.create(data);
		return this.repo.save(entity);
	}

	async findLatest(): Promise<OverbookingEvaluationReportEntity | null> {
		return this.repo.findOne({
			order: { evaluatedAt: "DESC" },
		});
	}

	async findHistory(limit = 20): Promise<OverbookingEvaluationReportEntity[]> {
		return this.repo.find({
			order: { evaluatedAt: "DESC" },
			take: limit,
		});
	}

	async findById(id: string): Promise<OverbookingEvaluationReportEntity | null> {
		return this.repo.findOne({
			where: { id },
		});
	}
}
