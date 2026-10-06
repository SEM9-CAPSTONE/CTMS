import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import {
	PorterRouteProficiency,
	type PorterRouteQualification,
} from "../entities/porter-route-qualification.entity";

export interface QualificationIdentity {
	id: string;
	porterId: string;
	routeId: string;
}

export interface RouteQualificationReviewRow {
	qualificationId: string;
	porterId: string;
	porterDisplayName: string | null;
	routeId: string;
	proficiency: PorterRouteProficiency;
	timesLed: number;
	verifiedBy: string | null;
	verifiedAt: Date | null;
	version: number;
	createdAt: Date;
	updatedAt: Date;
}

@Injectable()
export class PorterRouteQualificationsRepository extends Repository<PorterRouteQualification> {
	listByPorterId(porterId: string): Promise<PorterRouteQualification[]> {
		return this.find({ where: { porterId }, order: { createdAt: "ASC", id: "ASC" } });
	}

	async listByRouteId(routeId: string): Promise<RouteQualificationReviewRow[]> {
		const rows = await this.createQueryBuilder("qualification")
			.innerJoin("qualification.porter", "porter")
			.select("qualification.id", "qualificationId")
			.addSelect("qualification.porterId", "porterId")
			.addSelect("porter.fullName", "porterDisplayName")
			.addSelect("qualification.routeId", "routeId")
			.addSelect("qualification.proficiency", "proficiency")
			.addSelect("qualification.timesLed", "timesLed")
			.addSelect("qualification.verifiedBy", "verifiedBy")
			.addSelect("qualification.verifiedAt", "verifiedAt")
			.addSelect("qualification.version", "version")
			.addSelect("qualification.createdAt", "createdAt")
			.addSelect("qualification.updatedAt", "updatedAt")
			.where("qualification.routeId = :routeId", { routeId })
			.orderBy("qualification.createdAt", "ASC")
			.addOrderBy("qualification.id", "ASC")
			.getRawMany<RouteQualificationReviewRow>();
		return rows;
	}

	async findIdentityById(id: string): Promise<QualificationIdentity | null> {
		const row = await this.createQueryBuilder("qualification")
			.select("qualification.id", "id")
			.addSelect("qualification.porterId", "porterId")
			.addSelect("qualification.routeId", "routeId")
			.where("qualification.id = :id", { id })
			.getRawOne<QualificationIdentity>();
		return row ?? null;
	}

	findByIdForUpdate(id: string): Promise<PorterRouteQualification | null> {
		return this.createQueryBuilder("qualification")
			.where("qualification.id = :id", { id })
			.setLock("pessimistic_write")
			.getOne();
	}

	findByPorterAndRouteForUpdate(
		porterId: string,
		routeId: string
	): Promise<PorterRouteQualification | null> {
		return this.createQueryBuilder("qualification")
			.where("qualification.porterId = :porterId", { porterId })
			.andWhere("qualification.routeId = :routeId", { routeId })
			.setLock("pessimistic_write")
			.getOne();
	}

	async isVerifiedLeadQualified(
		porterId: string,
		routeId: string,
		manager?: EntityManager
	): Promise<boolean> {
		const repository = manager ? manager.withRepository(this) : this;
		return repository
			.createQueryBuilder("qualification")
			.where("qualification.porterId = :porterId", { porterId })
			.andWhere("qualification.routeId = :routeId", { routeId })
			.andWhere("qualification.proficiency IN (:...proficiencies)", {
				proficiencies: [PorterRouteProficiency.PROFICIENT, PorterRouteProficiency.EXPERT],
			})
			.andWhere("qualification.verifiedBy IS NOT NULL")
			.andWhere("qualification.verifiedAt IS NOT NULL")
			.getExists();
	}
}
