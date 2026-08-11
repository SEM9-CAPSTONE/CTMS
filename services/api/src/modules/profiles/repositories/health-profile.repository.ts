import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { HealthProfile } from "../entities/health-profile.entity";

@Injectable()
export class HealthProfileRepository extends Repository<HealthProfile> {
	async findByUserId(userId: string): Promise<HealthProfile | null> {
		return this.findOne({
			where: { userId },
			relations: { user: true },
		});
	}
}
