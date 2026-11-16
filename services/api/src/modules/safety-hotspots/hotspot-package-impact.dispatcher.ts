import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { OfflinePackagesService } from "../offline-packages/offline-packages.service";
import { PackageFailure } from "../offline-packages/offline-packages.types";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { HotspotCorrectiveActionsRepository } from "./hotspot-corrective-actions.repository";

const RETRY_BATCH = 50;

/** Stable impact identity: re-requesting the same correction never creates a second package job. */
export function correctionImpactId(actionId: string): string {
	return `hotspot-correction:${actionId}`;
}

/**
 * CTMS-118 / BR-359: hands package-affecting corrections to the Offline Safety Package generator
 * (CTMS-119), which builds a new version and never rewrites a published one. This class can only
 * request package jobs; it cannot change Route or safety data, so the background worker uses it
 * without gaining any write path to authoritative data (BR-356).
 */
@Injectable()
export class HotspotPackageImpactDispatcher {
	private readonly logger = new Logger(HotspotPackageImpactDispatcher.name);

	constructor(
		private readonly repository: HotspotCorrectiveActionsRepository,
		private readonly packages: OfflinePackagesService
	) {}

	/** True when every Trip was handed over (or is no longer eligible) and the action is stamped. */
	async dispatch(actionId: string, tripIds: string[], now: Date = new Date()): Promise<boolean> {
		for (const tripId of tripIds) {
			try {
				await this.packages.requestImpact(tripId, correctionImpactId(actionId));
			} catch (error) {
				// A Trip that stopped being published keeps its activated/historic version; nothing to do.
				if (error instanceof PackageFailure) continue;
				const message = error instanceof Error ? error.message : "unknown error";
				this.logger.warn(`Package impact request for correction ${actionId} deferred: ${message}`);
				return false;
			}
		}
		await this.repository.markImpactRequested(actionId, now);
		return true;
	}

	/** Re-requests corrections whose hand-over did not complete (e.g. a crash after commit). */
	async retryPending(): Promise<number> {
		let dispatched = 0;
		for (const pending of await this.repository.findPendingImpacts(RETRY_BATCH)) {
			if (await this.dispatch(pending.id, pending.impactTripIds)) dispatched += 1;
		}
		return dispatched;
	}
}
