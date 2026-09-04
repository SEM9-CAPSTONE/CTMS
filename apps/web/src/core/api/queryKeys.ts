export const queryKeys = {
	auth: {
		me: ["auth", "me"] as const,
	},
	campsites: {
		all: ["campsites"] as const,
		list: (filters?: Record<string, unknown>) => ["campsites", "list", filters] as const,
		detail: (id: string) => ["campsites", "detail", id] as const,
		zones: (campsiteId: string) => ["campsites", campsiteId, "zones"] as const,
		slots: (zoneId: string) => ["campsite-zones", zoneId, "slots"] as const,
	},
	bookings: {
		all: ["bookings"] as const,
		list: (filters?: Record<string, unknown>) => ["bookings", "list", filters] as const,
		detail: (id: string) => ["bookings", "detail", id] as const,
	},
	trekking: {
		all: ["trekking-routes"] as const,
		pendingReview: ["trekking-routes", "pending-review"] as const,
		list: (filters?: Record<string, unknown>) => ["trekking-routes", "list", filters] as const,
		detail: (id: string) => ["trekking-routes", "detail", id] as const,
		checkpoints: (routeId: string) => ["trekking-routes", routeId, "checkpoints"] as const,
	},
	trips: {
		all: ["trips"] as const,
		list: (filters?: Record<string, unknown>) => ["trips", "list", filters] as const,
		detail: (id: string) => ["trips", "detail", id] as const,
	},
	weather: {
		risk: (routeId?: string, campsiteId?: string) =>
			["weather", "risk", { routeId, campsiteId }] as const,
		rules: ["weather", "rules"] as const,
		activeRule: ["weather", "rules", "active"] as const,
	},
	ai: {
		conversations: ["ai", "conversations"] as const,
		messages: (conversationId: string) => ["ai", "messages", conversationId] as const,
	},
	sos: {
		alerts: ["sos-alerts"] as const,
		detail: (id: string) => ["sos-alerts", id] as const,
	},
	profile: {
		me: ["profile", "me"] as const,
	},
};
