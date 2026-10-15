export const queryKeys = {
	auth: {
		me: ["auth", "me"] as const,
	},
	bookings: {
		all: ["bookings"] as const,
		list: (filters?: Record<string, unknown>) => ["bookings", "list", filters] as const,
		detail: (id: string) => ["bookings", "detail", id] as const,
		refunds: (bookingId: string) => ["bookings", "refunds", bookingId] as const,
	},
	trekking: {
		all: ["trekking-routes"] as const,
		pendingReview: ["trekking-routes", "pending-review"] as const,
		list: (filters?: Record<string, unknown>) => ["trekking-routes", "list", filters] as const,
		detail: (id: string) => ["trekking-routes", "detail", id] as const,
		checkpoints: (routeId: string) => ["trekking-routes", routeId, "checkpoints"] as const,
	},
	trips: {
		availablePorters: (
			tripId: string,
			role: "lead" | "support" | null,
			minExperienceYears: number | undefined,
			page: number,
			limit: number
		) => ["trips", tripId, "available-porters", { role, minExperienceYears, page, limit }] as const,
		porterRequests: (tripId: string) => ["trips", tripId, "porter-requests"] as const,
		myPorterRequests: ["trips", "porter-requests", "mine"] as const,
		hostPorterRequests: ["trips", "porter-requests", "host"] as const,
		pendingPorterRequest: (tripId: string, porterId: string) =>
			["trips", tripId, "porter-requests", "pending", porterId] as const,
		assigned: ["trips", "assigned"] as const,
		hostPorterAssignments: ["trips", "porter-assignments", "host"] as const,
		all: ["trips"] as const,
		list: (filters?: Record<string, unknown>) => ["trips", "list", filters] as const,
		detail: (id: string) => ["trips", "detail", id] as const,
	},
	weather: {
		risk: (routeId?: string) => ["weather", "risk", { routeId }] as const,
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
	porter: {
		profile: ["porter", "profile"] as const,
		routeQualifications: ["porter", "route-qualifications"] as const,
		routePorterQualifications: (routeId: string) =>
			["trekking-routes", routeId, "porter-qualifications"] as const,
	},
	adminRefunds: {
		all: ["admin-refunds"] as const,
		list: (filters?: Record<string, unknown>) => ["admin-refunds", "list", filters] as const,
	},
	settlements: {
		all: ["settlements"] as const,
		evaluation: (tripId: string) => ["settlements", "evaluation", tripId] as const,
		adminList: (filters?: Record<string, unknown>) =>
			["settlements", "adminList", filters] as const,
		hostWallet: ["settlements", "hostWallet"] as const,
		adminPayouts: (filters?: Record<string, unknown>) =>
			["settlements", "adminPayouts", filters] as const,
	},
	bankAccounts: {
		all: ["bank-accounts"] as const,
	},
};
