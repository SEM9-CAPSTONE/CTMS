import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type Repository } from "typeorm";
import { RealtimeEvaluationReportEntity } from "./entities/realtime-evaluation-report.entity";
import { RealtimeLatencySampleEntity } from "./entities/realtime-latency-sample.entity";
import type { RealtimeSampleRecord } from "./realtime-evaluation.harness";

@Injectable()
export class RealtimeEvaluationRepository {
	private readonly reports: Repository<RealtimeEvaluationReportEntity>;

	constructor(private readonly dataSource: DataSource) {
		this.reports = this.dataSource.getRepository(RealtimeEvaluationReportEntity);
	}

	/** Stores the report and every timing sample together. */
	async saveReport(
		data: Partial<RealtimeEvaluationReportEntity>,
		samples: RealtimeSampleRecord[]
	): Promise<RealtimeEvaluationReportEntity> {
		return this.dataSource.transaction(async (manager) => {
			const report = await manager
				.getRepository(RealtimeEvaluationReportEntity)
				.save(manager.getRepository(RealtimeEvaluationReportEntity).create(data));
			const rows = samples.map((sample) => ({
				reportId: report.id,
				scenario: sample.scenario,
				eventType: sample.eventType,
				eventId: sample.eventId,
				sequence: sample.sequence === null ? null : String(sample.sequence),
				clientIndex: sample.clientIndex,
				warmup: sample.warmup,
				sentAt: sample.sentAt,
				receivedAt: sample.receivedAt,
				acknowledgedAt: sample.acknowledgedAt,
				latencyMs: sample.latencyMs,
			}));
			for (let start = 0; start < rows.length; start += 500) {
				await manager
					.getRepository(RealtimeLatencySampleEntity)
					.insert(rows.slice(start, start + 500));
			}
			return report;
		});
	}

	async countSamples(reportId: string): Promise<number> {
		return this.dataSource
			.getRepository(RealtimeLatencySampleEntity)
			.count({ where: { reportId } });
	}

	async findLatest(): Promise<RealtimeEvaluationReportEntity | null> {
		return this.reports.findOne({ where: {}, order: { evaluatedAt: "DESC", id: "DESC" } });
	}

	async findHistory(limit: number): Promise<RealtimeEvaluationReportEntity[]> {
		return this.reports.find({ order: { evaluatedAt: "DESC", id: "DESC" }, take: limit });
	}

	async findById(id: string): Promise<RealtimeEvaluationReportEntity | null> {
		return this.reports.findOne({ where: { id } });
	}
}
