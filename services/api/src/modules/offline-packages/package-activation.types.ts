import type { PackageSourceFreshness } from "./package-freshness.source";

export interface PackagePolicyContext {
	departureCheck: { checkedAt: string; reasonCode: string } | null;
	tripId: string;
	tripStatus: string;
	checkedAt: string;
	selected: { packageId: string; version: number; updatedAt: string };
	integrity: {
		serverArtifact: "verified" | "unavailable";
		state: "client_reported_verified" | "unknown";
		serverVerifiedClientBytes: false;
	};
	deviceReport: {
		state: "downloaded" | "verified" | "active";
		downloadedAt: string;
		verifiedAt: string | null;
		activatedAt: string | null;
	} | null;
	publication: {
		latestVersion: number;
		newerAvailable: boolean;
		requiredPackageId: string | null;
		requiredVersion: number | null;
		updateRequired: boolean;
	};
	sourceFreshness: PackageSourceFreshness;
	replaceAllowed: boolean;
	lockedPackageId: string | null;
	lockedAt: string | null;
}
