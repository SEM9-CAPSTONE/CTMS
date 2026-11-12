/** BR-357 lifecycle. Detection only ever creates DETECTED; the other states belong to CTMS-117. */
export enum SafetyHotspotStatus {
	DETECTED = "DETECTED",
	UNDER_REVIEW = "UNDER_REVIEW",
	CONFIRMED = "CONFIRMED",
	DISMISSED = "DISMISSED",
}

/** Why a qualifying cluster did not become a new candidate. */
export enum SafetyHotspotSkipReason {
	/** An open or confirmed candidate already covers this place on the same Route version. */
	ALREADY_COVERED = "ALREADY_COVERED",
	/** A dismissed candidate covers this place and no evidence started after the dismissal (BR-422). */
	DISMISSED_WITHOUT_NEW_EVIDENCE = "DISMISSED_WITHOUT_NEW_EVIDENCE",
	/** The exact same evidence already produced a candidate. */
	DUPLICATE_EVIDENCE = "DUPLICATE_EVIDENCE",
}
