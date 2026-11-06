import { Injectable } from "@nestjs/common";
import {
	OfflineSafetySources,
	PackageReason,
	type PackageSafetyInputs,
} from "./offline-packages.types";

/** Deliberately unconfigured until upstream supplies authoritative approvals/feed runs.
 * Do not replace this with incident-status mapping, preview results, or seeded approvals. */
@Injectable()
export class UnavailableOfflineSafetySources extends OfflineSafetySources {
	async read(): Promise<PackageSafetyInputs> {
		return {
			revision: "upstream-unavailable-v1",
			policy: null,
			conditionEvidence: [],
			feeds: [],
			hazards: [],
			guidance: [],
			blockers: [
				PackageReason.HAZARD_FEED_UNAVAILABLE,
				PackageReason.GUIDANCE_APPROVAL_UNAVAILABLE,
				PackageReason.GUIDANCE_POLICY_UNAVAILABLE,
			],
		};
	}
}
