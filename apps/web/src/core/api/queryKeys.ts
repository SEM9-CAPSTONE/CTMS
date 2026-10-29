export const queryKeys = {
	hostOverview: {
		forHost: (hostId: string) => ["host-overview", hostId] as const,
		routeName: (hostId: string, routeId: string) =>
			["host-overview", hostId, "route-name", routeId] as const,
		page: (hostId: string, page: number, limit: number) =>
			["host-overview", hostId, { page, limit }] as const,
	},
	porterLevels: {
		requests: (userId: string, admin: boolean, filters: unknown) =>
			["porter-levels", "requests", userId, admin, filters] as const,
		request: (userId: string, admin: boolean, id: string | null) =>
			["porter-levels", "request", userId, admin, id] as const,
		myQualifications: (userId: string) =>
			["porter-levels", "mine", userId, "qualifications"] as const,
		notifications: (userId: string) => ["porter-levels", "notifications", userId] as const,
		all: ["porter-levels"] as const,
		policies: ["porter-levels", "policies"] as const,
		qualifications: (page: number) => ["porter-levels", "qualifications", page] as const,
		comparison: (id: string | null, level: string) =>
			["porter-levels", "comparison", id, level] as const,
		history: (id: string | null) => ["porter-levels", "history", id] as const,
		myPolicies: ["porter-levels", "mine", "policies"] as const,
		myEvidence: (userId: string) => ["porter-levels", "mine", userId, "evidence"] as const,
		myHistory: (userId: string) => ["porter-levels", "mine", userId, "history"] as const,
	},
	auth: {
		me: ["auth", "me"] as const,
	},
	bookings: {
		camperMap: (userId: string) => ["bookings", "camper-map", userId] as const,
		cancellationNotices: (userId: string) => ["bookings", "cancellation-notices", userId] as const,
		all: ["bookings"] as const,
		list: (filters?: Record<string, unknown>) => ["bookings", "list", filters] as const,
		detail: (id: string) => ["bookings", "detail", id] as const,
		refunds: (bookingId: string) => ["bookings", "refunds", bookingId] as const,
	},
	trekking: {
		hostTripMap: (hostId: string, routeId: string) =>
			["trekking-routes", "host-trip-map", hostId, routeId] as const,
		all: ["trekking-routes"] as const,
		pendingReview: ["trekking-routes", "pending-review"] as const,
		list: (filters?: Record<string, unknown>) => ["trekking-routes", "list", filters] as const,
		detail: (id: string) => ["trekking-routes", "detail", id] as const,
		checkpoints: (routeId: string) => ["trekking-routes", routeId, "checkpoints"] as const,
	},
	trips: {
		formDrafts: ["trip-form-drafts"] as const,
		formDraftThumbnail: (id: string, version: string) =>
			["trip-form-draft-thumbnail", id, version] as const,
		formDraft: (id: string) => ["trip-form-drafts", id] as const,
		images: (tripId: string) => ["trips", "images", tripId] as const,
		camperCarousel: (userId: string) => ["trips", "camper-carousel", userId] as const,
		bookedRouteMap: (userId: string, tripId: string) =>
			["trips", "booked-route-map", userId, tripId] as const,
		hostOverview: (hostId: string) => ["trips", "host-overview", hostId] as const,
		hostOverviewAssignments: (hostId: string) =>
			["trips", "host-overview-assignments", hostId] as const,
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
		assignedOperations: (porterId: string, tripId: string) =>
			["trips", "assigned", porterId, tripId] as const,
		hostPorterAssignments: ["trips", "porter-assignments", "host"] as const,
		incidents: (userId: string, tripId: string) => ["trips", tripId, "incidents", userId] as const,
		all: ["trips"] as const,
		list: (filters?: Record<string, unknown>) => ["trips", "list", filters] as const,
		detail: (id: string) => ["trips", "detail", id] as const,
		progress: (tripId: string) => ["trips", tripId, "progress"] as const,
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
	deviceSync: {
		status: (tripId: string) => ["device-sync", "status", tripId] as const,
	},
};
