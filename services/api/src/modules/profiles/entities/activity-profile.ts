export interface ActivityProfile {
	comfortableDistanceKm: number | null;
	comfortableWalkingMinutes: number | null;
	activityNotes: string | null;
	confirmedAt: string | null;
}

export function mergeActivityNotes(...notes: Array<string | null | undefined>): string | null {
	return (
		[
			...new Set(notes.map((note) => note?.trim()).filter((note): note is string => Boolean(note))),
		].join("\n\n") || null
	);
}
