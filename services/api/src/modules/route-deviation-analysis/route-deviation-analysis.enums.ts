/** Why an episode ended. */
export enum RouteDeviationEndReason {
	/** 3 consecutive valid samples closer than 20 m to the Route. */
	RECOVERED = "RECOVERED",
	/** The participant's evidence ended (Trip completed or member left) while still off route. */
	EVIDENCE_ENDED = "EVIDENCE_ENDED",
}

/** BR-363 / spec §10: context gaps that keep an episode out of authoritative evidence. */
export enum RouteDeviationContextIssue {
	PACKAGE_VERSION_MISSING = "PACKAGE_VERSION_MISSING",
	PACKAGE_VERSION_INCONSISTENT = "PACKAGE_VERSION_INCONSISTENT",
}

/** Why a stored GPS log was not used for the replay. */
export enum RouteDeviationExclusionReason {
	/** BR-362: outside the participant's Trip window (before check-in, after leaving...). */
	OUTSIDE_PARTICIPATION = "OUTSIDE_PARTICIPATION",
	/** The user no longer holds an eligible Camper or Porter role on the Trip. */
	PARTICIPATION_NOT_ELIGIBLE = "PARTICIPATION_NOT_ELIGIBLE",
}
