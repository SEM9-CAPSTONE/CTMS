export type ModerationScanStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "not_applicable";
export type ImageScanStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "unsupported"
	| "not_applicable";

export type ModerationFlagType =
	| "profanity_or_insult"
	| "personal_data_leak"
	| "spam_or_irrelevant"
	| "harassment"
	| "inappropriate_image";

export type DetectionSource = "model" | "rule";
export type FlagLifecycleStatus = "active" | "superseded" | "resolved";

export type AspectType = "safety" | "guide_support" | "equipment" | "value";
export type SentimentType = "positive" | "neutral" | "negative";

export type IncidentType = "fall_slip" | "injury" | "lost_path" | "weather_hazard" | "other";
export type IncidentOccurred = "yes" | "warning" | "unknown";
export type IncidentSeverity = "minor" | "moderate" | "severe" | "unknown";

export interface ModerationConfig {
	provider: string;
	model: string;
	configVersion: string;
	promptVersion: string;
}

export interface ReviewModerationOutboxRecord {
	id: string;
	reviewId: string;
	sourceRevision: number;
	configVersion: string;
	createdAt: Date;
	processedAt: Date | null;
}

export interface DetectedPiiFlag {
	flagType: "personal_data_leak";
	detectionSource: "rule";
	confidence: null;
	evidence: string;
	quote: string;
}

export interface PiiMaskResult {
	maskedText: string;
	piiFlags: DetectedPiiFlag[];
}

export type ModerationStatus = "visible" | "hidden";

export type ImageStorageState =
	| "live"
	| "quarantine_pending"
	| "quarantined"
	| "restore_pending"
	| "quarantine_failed"
	| "restore_failed";

export type HostModerationDecision = "keep" | "hide" | "restore";

export interface HostModerationDecisionRecord {
	id: string;
	reviewId: string;
	revision: number;
	hostId: string;
	decision: HostModerationDecision;
	reason: ModerationFlagType | null;
	note: string | null;
	createdAt: Date;
}

export interface ModerationQueueItem {
	reviewId: string;
	tripId: string;
	tripTitle: string;
	reviewerId: string;
	rating: number;
	comment: string | null;
	images: string[];
	sourceRevision: number;
	createdAt: Date;
	moderationStatus: ModerationStatus;
	imageStorageState: ImageStorageState;
	hiddenReason: ModerationFlagType | null;
	activeFlags: Array<{
		id: string;
		flagType: ModerationFlagType;
		channel: "text" | "image";
		detectionSource: DetectionSource;
		confidence: number | null;
		evidence: string;
		quote: string | null;
		targetImageIndex: number | null;
		createdAt: Date;
	}>;
}
