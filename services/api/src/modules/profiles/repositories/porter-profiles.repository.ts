import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { PorterProfile } from "../entities/porter-profile.entity";

@Injectable()
export class PorterProfilesRepository extends Repository<PorterProfile> {
	findByPorterId(porterId: string): Promise<PorterProfile | null> {
		return this.findOneBy({ porterId });
	}

	findByPorterIdForUpdate(porterId: string): Promise<PorterProfile | null> {
		return this.createQueryBuilder("profile")
			.where("profile.porterId = :porterId", { porterId })
			.setLock("pessimistic_write")
			.getOne();
	}
}
