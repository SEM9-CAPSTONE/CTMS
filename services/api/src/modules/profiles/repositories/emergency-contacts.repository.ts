import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { EmergencyContact } from "../entities/emergency-contact.entity";

@Injectable()
export class EmergencyContactsRepository extends Repository<EmergencyContact> {
	findByUserId(userId: string): Promise<EmergencyContact[]> {
		return this.find({
			where: { userId },
			order: { createdAt: "ASC" },
		});
	}
}
