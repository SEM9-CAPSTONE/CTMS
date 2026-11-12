export const queryKeys = {
	demandInsights: {
		periods: (actor: string) => ["demand-insights", actor, "periods"] as const,
		report: (actor: string, month: string) => ["demand-insights", actor, month] as const,
		planning: (actor: string, month: string) =>
			["demand-insights", actor, month, "planning"] as const,
	},
	reviewAnalysis: {
		all: ["review-analysis"] as const,
		trips: (actor: string, page: number) => ["review-analysis", actor, "trips", page] as const,
		insights: (actor: string, trip: string, page: number) =>
			["review-analysis", actor, trip, "insights", page] as const,
		batch: (actor: string, trip: string, batch: string) =>
			["review-analysis", actor, trip, "batch", batch] as const,
		source: (actor: string, trip: string, review: string, revision: number) =>
			["review-analysis", actor, trip, "source", review, revision] as const,
	},
	reviewModeration: {
		all: ["review-moderation"] as const,
		queue: (actor: string, status: string, tripId?: string, page = 1) =>
			["review-moderation", actor, "queue", status, tripId ?? "all", page] as const,
		pendingBadge: (actor: string) => ["review-moderation", actor, "pending-badge"] as const,
	},
	reviewAnalytics: {
		all: ["review-analytics"] as const,
		tripsOverview: (actor: string, page = 1, tripId?: string) =>
			["review-analytics", actor, "trips-overview", tripId ?? "all", page] as const,
		routesSafetyOverview: (actor: string, page = 1, routeId?: string) =>
			["review-analytics", actor, "routes-safety", routeId ?? "all", page] as const,
	},
	survivalDocuments: {
		all: ["survival-documents"] as const,
		lists: ["survival-documents", "list"] as const,
		details: ["survival-documents", "detail"] as const,
		list: (filters: unknown) => ["survival-documents", "list", filters] as const,
		detail: (id: string | null) => ["survival-documents", "detail", id] as const,
		file: (id: string, versionId: string) => ["survival-documents", "file", id, versionId] as const,
	},
	routeSafety: {
		terrain: (hostId: string, geometry: string, version: string) =>
			["route-terrain", version, hostId, geometry] as const,
		analyze: (hostId: string, routeId: string | undefined, geometry: string, source?: string) =>
			["route-safety", hostId, routeId ?? "preview", geometry, source ?? "all"] as const,
	},
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
		hostList: (hostId: string, filters: Record<string, string | number>) =>
			["trekking-routes", "host-list", hostId, filters] as const,
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
		scheduleProgress: (tripId: string) => ["trips", tripId, "schedule-progress"] as const,
		memberLocations: (tripId: string) => ["trips", tripId, "member-locations"] as const,
		emergencyBroadcasts: (tripId: string) => ["trips", tripId, "emergency-broadcasts"] as const,
		tripDatesWeather: (tripId: string) =>
			["trips", tripId, "weather-forecast", "trip-dates"] as const,
		tripWeatherHistory: (tripId: string) =>
			["trips", tripId, "weather-forecast", "history"] as const,
		all: ["trips"] as const,
		list: (filters?: Record<string, unknown>) => ["trips", "list", filters] as const,
		detail: (id: string) => ["trips", "detail", id] as const,
		progress: (tripId: string) => ["trips", tripId, "progress"] as const,
	},
	weather: {
		risk: (routeId?: string) => ["weather", "risk", { routeId }] as const,
		rules: ["weather", "rules"] as const,
		activeRule: ["weather", "rules", "active"] as const,
		changeNotices: (userId: string) => ["weather", "change-notices", userId] as const,
		decisionAlerts: (userId: string) => ["weather", "decision-alerts", userId] as const,
		interventions: ["weather", "interventions"] as const,
		aiMismatches: ["weather", "ai-mismatches"] as const,
		decisionLog: (tripId: string) => ["weather", "decision-log", tripId] as const,
		myPenalties: (userId: string) => ["weather", "penalties", "mine", userId] as const,
		adminPenalties: (filter: string) => ["weather", "penalties", "admin", filter] as const,
	},
	ai: {
		conversations: ["ai", "conversations"] as const,
		messages: (conversationId: string) => ["ai", "messages", conversationId] as const,
	},
	sos: {
		alerts: ["sos-alerts"] as const,
		detail: (id: string) => ["sos-alerts", id] as const,
		tripList: (tripId: string) => ["trips", tripId, "sos"] as const,
		hostList: (filters?: Record<string, unknown>) => ["sos", "host-list", filters] as const,
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
	performanceReports: {
		all: ["performance-reports"] as const,
		report: (filters?: Record<string, unknown>) =>
			["performance-reports", "report", filters] as const,
	},
};
