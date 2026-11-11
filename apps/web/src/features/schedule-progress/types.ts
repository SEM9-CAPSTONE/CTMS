/** CTMS-063 `GET /trips/:tripId/schedule-progress` contract (CTMS-319, spec §14). */
export type ScheduleStatus = "ON_TRACK" | "BEHIND" | "SEVERELY_BEHIND" | "LOCATION_UNKNOWN";

export interface CamperScheduleProgress {
	userId: string;
	fullName: string | null;
	status: ScheduleStatus;
	reference: { checkpointId: string; checkpointName: string; porterArrivedAt: string } | null;
	lagMinutes: number | null;
	safeCheckpoint: { id: string; name: string; type: string } | null;
	guidance: string | null;
	lastValidSampleAt: string | null;
	levelsReached: Array<"BEHIND" | "SEVERELY_BEHIND">;
}

export interface ScheduleProgressResponse {
	tripId: string;
	tripStatus: string;
	evaluatedAt: string;
	viewer: "camper" | "team";
	configVersion: string;
	thresholds: {
		behindLagMinutes: number;
		severelyBehindLagMinutes: number;
		locationUnknownAfterMinutes: number;
	};
	members: CamperScheduleProgress[];
}
