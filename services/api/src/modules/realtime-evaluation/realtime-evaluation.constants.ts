/** Version of the scenario set run by the harness (BR-282 "dataset/version"). */
export const REALTIME_EVALUATION_SCENARIO_VERSION = "v3.0.0-realtime-performance";
/** Version of this procedure: metric definitions, percentile method and stable-connection rule. */
export const REALTIME_EVALUATION_CONFIG_VERSION = "v3-realtime-evaluation-1";
export const REALTIME_EVALUATION_RULE_VERSION = "BR-281+BR-265+BR-282";

/** BR-281 V3 release gates. The SOS gate is strict (`< 5 s`), the others inclusive. */
export const REALTIME_RELEASE_GATES = {
	SOS_P95_BELOW_MS: 5000,
	NORMAL_P95_MAX_MS: 2000,
	NORMAL_P99_MAX_MS: 5000,
	MIN_RECOVERY_PERCENT: 100,
} as const;

/** Defaults and upper bounds of a run, so one Admin request stays short and bounded. */
export const REALTIME_EVALUATION_LIMITS = {
	sosEvents: { default: 100, min: 20, max: 500 },
	normalEvents: { default: 200, min: 20, max: 1000 },
	concurrentClients: { default: 10, min: 2, max: 50 },
	missedEvents: { default: 20, min: 1, max: 200 },
} as const;

/** Stable connection (spec §12): the first events only warm the connection and are not measured. */
export const REALTIME_EVALUATION_WARMUP_EVENTS = 5;
/** An event not received within this time is undelivered (counted as infinite latency). */
export const REALTIME_EVALUATION_DELIVERY_TIMEOUT_MS = 10_000;
export const REALTIME_EVALUATION_CONNECT_TIMEOUT_MS = 10_000;
export const REALTIME_EVALUATION_ACK_TIMEOUT_MS = 5_000;

export const REALTIME_EVALUATION_HISTORY_LIMIT = 20;
export const REALTIME_EVALUATION_MAX_HISTORY_LIMIT = 100;

/** Temporary probe accounts are created with this e-mail domain and deleted after the run. */
export const REALTIME_EVALUATION_PROBE_EMAIL_DOMAIN = "evaluation.ctms.invalid";
