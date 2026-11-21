import { Injectable } from "@nestjs/common";
import {
	type CorrectiveActionRow,
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	HotspotCorrectiveActionsRepository,
} from "./hotspot-corrective-actions.repository";

/**
 * CTMS-118 history: corrective actions that earlier changed Route safety data from a CONFIRMED
 * hotspot. New corrections are no longer created; Admins edit or delete the hotspot itself.
 */
@Injectable()
export class HotspotCorrectiveActionsService {
	constructor(private readonly repository: HotspotCorrectiveActionsRepository) {}

	listByHotspot(hotspotId: string): Promise<CorrectiveActionRow[]> {
		return this.repository.listByHotspot(hotspotId);
	}
}
