/** CTMS-063 §13 (approved V3 "lagging behind the Porter" approach); fixed, not user-configurable. */
export const BEHIND_LAG_MINUTES = 30;
export const SEVERELY_BEHIND_LAG_MINUTES = 60;

/** Same VALID-sample accuracy and on-site distance as CTMS-059/060 (BR-239). */
export const VALID_SAMPLE_MAX_ACCURACY_METERS = 20;
export const CHECKPOINT_PASS_RADIUS_METERS = 20;
/** On-route corridor (CTMS-060 OFF_ROUTE threshold): beyond it, progress along the Route is not trusted. */
export const ROUTE_CORRIDOR_METERS = 50;

/**
 * Server-side "location unknown" window (§13.10-3, approved): breadcrumbs are logged every 30 s and
 * uploaded in batches, so the on-device 120 s rule would flag Campers who are walking normally.
 */
export const LOCATION_UNKNOWN_AFTER_MINUTES = 5;

export const SCHEDULE_PROGRESS_CONFIG_VERSION = "v3";

/** §13.4: Checkpoint types that count as safe stopping places. */
export const SAFE_CHECKPOINT_TYPES: ReadonlySet<string> = new Set([
	"rest",
	"water",
	"emergency_shelter",
	"finish",
]);

/** §13.3 / §13.4 guidance, verbatim from the approved spec. */
export const GUIDANCE = {
	behind: (lagMinutes: number, referenceName: string, safeName: string) =>
		`Bạn đang chậm hơn đoàn khoảng ${lagMinutes} phút (Porter đã tới ${referenceName}). Hãy tiếp tục theo tuyến tới ${safeName} và liên hệ Porter.`,
	severelyBehind: (safeName: string) =>
		`Bạn đã tụt lại sau đoàn hơn 60 phút. Dừng tại ${safeName} và chờ Porter hướng dẫn. Porter sẽ quyết định đi tiếp hay quay về; Host đã được thông báo.`,
	locationUnknown: "Không xác định được vị trí của bạn.",
	noSafeCheckpoint:
		"Không có checkpoint an toàn gần đây. Dừng ở nơi an toàn, giữ liên lạc với Porter.",
} as const;
