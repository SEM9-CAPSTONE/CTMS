import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs metadata
import { DataSource, type EntityManager, type Repository } from "typeorm";
import { SosAlert } from "./entities/sos-alert.entity";
import type { SosStatus } from "./sos.enums";

export interface FindForHostOptions {
	status?: SosStatus;
	tripId?: string;
	search?: string;
	page?: number;
	limit?: number;
}

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
			relations: { trip: true, sender: true, acknowledger: true, closer: true },
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
			relations: { trip: true, sender: true, acknowledger: true, closer: true },
		});
	}

	async findForHost(
		hostId: string,
		options?: FindForHostOptions
	): Promise<{ items: SosAlert[]; total: number }> {
		const page = Math.max(1, options?.page ?? 1);
		const limit = Math.max(1, Math.min(50, options?.limit ?? 10));
		const skip = (page - 1) * limit;

		const qb = this.repo
			.createQueryBuilder("sos")
			.innerJoinAndSelect("sos.trip", "trip")
			.leftJoinAndSelect("sos.sender", "sender")
			.leftJoinAndSelect("sos.acknowledger", "acknowledger")
			.leftJoinAndSelect("sos.closer", "closer")
			.where("trip.host_id = :hostId", { hostId });

		if (options?.status) {
			qb.andWhere("sos.status = :status", { status: options.status });
		}

		if (options?.tripId) {
			qb.andWhere("sos.trip_id = :tripId", { tripId: options.tripId });
		}

		if (options?.search?.trim()) {
			const search = `%${options.search.trim().toLowerCase()}%`;
			qb.andWhere(
				"(LOWER(trip.title) LIKE :search OR LOWER(sender.full_name) LIKE :search OR LOWER(sender.email) LIKE :search OR LOWER(sos.emergency_type) LIKE :search)",
				{ search }
			);
		}

		qb.orderBy("sos.event_time", "DESC").skip(skip).take(limit);

		const [items, total] = await qb.getManyAndCount();
		return { items, total };
	}

	async save(alert: SosAlert, manager?: EntityManager): Promise<SosAlert> {
		const repository = manager ? manager.getRepository(SosAlert) : this.repo;
		return repository.save(alert);
	}

	create(data: Partial<SosAlert>): SosAlert {
		return this.repo.create(data);
	}
}
