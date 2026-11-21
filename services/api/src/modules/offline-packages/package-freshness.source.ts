import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";

export interface PackageSourceFreshness {
	state: "unknown" | "current" | "expired";
	expiresAt: string | null;
	reasonCodes: string[];
}

/** CTMS-119 owns impact evaluation and expiry. Do not infer it from checkedAt changes. */
export abstract class PackageFreshnessSource {
	abstract read(
		manager: EntityManager,
		tripId: string,
		packageId: string
	): Promise<PackageSourceFreshness>;
}
@Injectable()
export class UnavailablePackageFreshnessSource extends PackageFreshnessSource {
	async read(): Promise<PackageSourceFreshness> {
		return { state: "unknown", expiresAt: null, reasonCodes: ["SOURCE_FRESHNESS_UNAVAILABLE"] };
	}
}
