import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { PorterVerificationDocument } from "../entities/porter-verification-document.entity";

@Injectable()
export class PorterVerificationDocumentsRepository extends Repository<PorterVerificationDocument> {
	findByPorterId(porterId: string): Promise<PorterVerificationDocument[]> {
		return this.find({ where: { porterId }, order: { uploadedAt: "ASC", id: "ASC" } });
	}

	countByPorterId(porterId: string): Promise<number> {
		return this.countBy({ porterId });
	}

	findOneForPorter(porterId: string, id: string): Promise<PorterVerificationDocument | null> {
		return this.findOneBy({ id, porterId });
	}
}
