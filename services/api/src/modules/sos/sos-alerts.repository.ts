import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs metadata
import { DataSource, type EntityManager, type Repository } from "typeorm";
import { SosAlert } from "./entities/sos-alert.entity";

@Injectable()
export class SosAlertsRepository {
	constructor(private readonly dataSource: DataSource) {}

	private get repo(): Repository<SosAlert> {
		return this.dataSource.getRepository(SosAlert);
	}

	async findById(id: string, manager?: EntityManager): Promise<SosAlert | null> {
		const repository = manager ? manager.getRepository(SosAlert) : this.repo;
		return repository.findOne({
			where: { id },
			relations: { trip: true, sender: true },
		});
	}

	async findForUpdate(id: string, manager: EntityManager): Promise<SosAlert | null> {
		return manager.getRepository(SosAlert).findOne({
			where: { id },
			lock: { mode: "pessimistic_write" },
		});
	}

	async findByTripId(tripId: string, manager?: EntityManager): Promise<SosAlert[]> {
		const repository = manager ? manager.getRepository(SosAlert) : this.repo;
		return repository.find({
			where: { tripId },
			order: { createdAt: "DESC" },
			relations: { sender: true },
		});
	}

	async save(alert: SosAlert, manager?: EntityManager): Promise<SosAlert> {
		const repository = manager ? manager.getRepository(SosAlert) : this.repo;
		return repository.save(alert);
	}

	create(data: Partial<SosAlert>): SosAlert {
		return this.repo.create(data);
	}
}
