export const MODERATION_DEFAULT_PROVIDER = "gemini";
export const MODERATION_DEFAULT_MODEL = "gemini-3.1-flash-lite";
export const MODERATION_DEFAULT_CONFIG_VERSION = "gemini-v1";
export const MODERATION_DEFAULT_PROMPT_VERSION = "v1";

export const MODERATION_LEASE_DURATION_MS = 60_000;
export const MODERATION_HEARTBEAT_INTERVAL_MS = 20_000;
export const MODERATION_LOCK_TIMEOUT_MS = 5_000;
export const MODERATION_MAX_ATTEMPTS = 3;

export const MODERATION_POLICY_VERSION = "ctms-411-v1";
/** Basis points scale: 0.80 === 8000. Auto-hide triggers strictly when score > 8000 (> 80%). */
export const MODERATION_BASIS_POINTS_SCALE = 10_000;
export const MODERATION_AUTO_HIDE_THRESHOLD_BPS = 8_000;
export const MODERATION_UNVERIFIED_TIMEOUT_MS = 15 * 60 * 1000;
export const MODERATION_HOST_SLA_MS = 7 * 24 * 60 * 60 * 1000;
