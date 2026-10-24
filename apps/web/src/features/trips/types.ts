import type {
	GeoJsonLineString,
	GeoJsonPoint,
	RouteCheckpoint,
	RouteDangerZone,
	RouteStatus,
} from "../trekking-routes/types";
import type { WeatherCriteriaScores } from "../weather/utils/weather-risk";

export const TRIP_TYPES = ["day_trip", "overnight"] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export type TripStatus =
	| "draft"
	| "pending_approval"
	| "published"
	| "ongoing"
	| "completed"
	| "cancelled"
	| "rejected";

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
	draft: "Bản nháp",
	pending_approval: "Chờ duyệt",
	published: "Đã mở bán",
	ongoing: "Đang diễn ra",
	completed: "Kết thúc",
	cancelled: "Đã huỷ",
	rejected: "Từ chối",
};

export function formatTripStatus(status: TripStatus): string {
	return TRIP_STATUS_LABELS[status] ?? status;
}

export const TRIP_WAYPOINT_TYPES = [
	"start",
	"checkpoint",
	"rest",
	"meal",
	"activity",
	"overnight",
	"finish",
] as const;
export type TripWaypointType = (typeof TRIP_WAYPOINT_TYPES)[number];

export interface CreateTripWaypointInput {
	checkpointId?: string;
	type: TripWaypointType;
	name: string;
	location: GeoJsonPoint;
	plannedAt: string;
	metadata?: Record<string, unknown>;
}

export interface ConfigureTripWaypointsInput {
	waypoints: CreateTripWaypointInput[];
}

export interface CreateTripInput {
	routeId: string;
	title: string;
	description?: string;
	coverImageUrl?: string;
	tripType: TripType;
	startsAt: string;
	endsAt: string;
	meetingPoint: GeoJsonPoint;
	meetingAt?: string;
	bookingDeadline: string;
	capacityMin: number;
	capacityMax: number | null;
	pricePerPerson: number;
	waypoints: CreateTripWaypointInput[];
}

export interface TripWaypoint {
	id: string;
	tripId: string;
	checkpointId: string | null;
	type: TripWaypointType;
	name: string;
	location: GeoJsonPoint;
	dayNumber: number;
	sequenceOrder: number;
	plannedAt: string | null;
	durationMinutes: number | null;
	metadata: Record<string, unknown> | null;
}

export type ReviewTripAction = "approve" | "decline";

export interface ReviewTripInput {
	action: ReviewTripAction;
	reviewedUpdatedAt: string;
	reason?: string;
}

export interface RescheduleTripInput {
	startsAt?: string;
	endsAt?: string;
}

export interface CancelTripInput {
	reason: string;
}

export interface SubmittedWeatherForecastSummary {
	id: string;
	status: TripWeatherForecastStatus;
	riskLevel: RiskLevel | null;
	riskAcknowledged: boolean;
}

export type TripWeatherForecastStatus = "available" | "out_of_range";

export interface TripWeatherWorstReading {
	rainfallMm: number;
	rainfallAt: string;
	windKph: number;
	windAt: string;
	temperatureC: number;
	temperatureAt: string;
	visibilityM: number;
	visibilityAt: string;
	thunderstorm: boolean;
	thunderstormAt: string | null;
	hoursCovered: number;
}

/** Weather forecast over a Trip's own schedule (not today's weather). */
export interface TripWeatherForecast {
	id: string;
	tripId: string;
	status: TripWeatherForecastStatus;
	tripStartsAt: string;
	tripEndsAt: string;
	forecastFrom: string | null;
	forecastTo: string | null;
	coversWholeTrip: boolean;
	worstReading: TripWeatherWorstReading | null;
	riskLevel: RiskLevel | null;
	compositeScore: number | null;
	criteriaScores: WeatherCriteriaScores | null;
	advice: { text: string; actions: string[]; generatedAt: string } | null;
	horizonDays: number;
	createdAt: string;
}

export interface SubmitTripInput {
	acknowledgeWeatherRisk?: boolean;
}

export interface Trip {
	id: string;
	hostId: string;
	routeId: string;
	title: string;
	description: string | null;
	coverImageUrl: string | null;
	itinerary: Record<string, unknown> | null;
	includes: Record<string, unknown> | null;
	excludes: Record<string, unknown> | null;
	tripType: TripType;
	durationNights: number;
	startsAt: string;
	endsAt: string;
	meetingPoint: GeoJsonPoint;
	meetingAt: string | null;
	bookingDeadline: string;
	capacityMin: number;
	capacityMax: number | null;
	seatsTaken: number;
	pricePerPerson: number;
	cancellationPolicy: Record<string, unknown> | null;
	status: TripStatus;
	createdAt: string;
	updatedAt: string;
	waypoints: TripWaypoint[];
	/** Only on the Admin pending-review list. */
	submittedWeatherForecast?: SubmittedWeatherForecastSummary | null;
}

export type TripReviewOutcome = "pending" | "approved" | "returned_for_revision" | "auto_rejected";
export type TripReviewOutcomeFilter = TripReviewOutcome | "all";

export interface AdminTripReview extends Trip {
	reviewOutcome: TripReviewOutcome;
	reviewedAt: string | null;
}

export interface AdminTripReviewsQuery {
	reviewOutcome: TripReviewOutcomeFilter;
	page: number;
	limit: number;
}

export interface PaginatedAdminTripReviews {
	items: AdminTripReview[];
	pagination: TripsPagination;
}

export type TrekkingRouteDifficulty = "easy" | "moderate" | "hard" | "expert";

export type RiskLevel = "green" | "yellow" | "red";

export interface TripRegistrationRiskFactor {
	key: string;
	label: string;
	value: number | boolean;
	level: RiskLevel;
	weight: number;
	score: number;
}

export interface TripRegistrationRisk {
	status: "available" | "unavailable";
	assessmentId: string | null;
	level: RiskLevel | null;
	assessedAt: string | null;
	ruleVersionId: string | null;
	factors: TripRegistrationRiskFactor[];
	advice: string | null;
	recommendations: string[];
}

export interface SearchTripsQuery {
	search?: string;
	tripType?: TripType;
	difficulty?: TrekkingRouteDifficulty;
	startDate?: string;
	endDate?: string;
	minPrice?: number;
	maxPrice?: number;
	routeId?: string;
	province?: string;
	city?: string;
	page?: number;
	limit?: number;
}

export interface TripSummary {
	id: string;
	title: string;
	description: string | null;
	coverImageUrl: string | null;
	tripType: TripType;
	durationNights: number;
	startsAt: string;
	endsAt: string;
	meetingPoint: GeoJsonPoint;
	meetingAt: string | null;
	bookingDeadline: string;
	capacityMin: number;
	capacityMax: number | null;
	seatsTaken: number;
	remainingSeats: number | null;
	pricePerPerson: number;
	status: TripStatus;
	difficulty: TrekkingRouteDifficulty | null;
	weatherRiskLevel: RiskLevel | null;
	isBookable: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface TripsPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface PaginatedTrips {
	items: TripSummary[];
	pagination: TripsPagination;
}

export type IntendedPorterRole = "lead" | "support";
export type PorterAvailabilityStatus = "available" | "unavailable";
export type PorterRouteProficiency = "learning" | "proficient" | "expert";

export interface AvailablePorter {
	porterId: string;
	displayName: string | null;
	avatarUrl?: string | null;
	experienceYears: number;
	availabilityStatus: PorterAvailabilityStatus;
	ratingAvg: number;
	completedTrips: number;
	proficiency?: PorterRouteProficiency;
}

export interface AvailablePortersQuery {
	role: IntendedPorterRole;
	minExperienceYears?: number;
	page: number;
	limit: number;
}

export interface AvailablePortersResponse {
	items: AvailablePorter[];
	pagination: TripsPagination;
}

export type PorterRequestStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export interface CreatePorterRequestInput {
	porterId: string;
	requestedRole: IntendedPorterRole;
	note?: string;
}

export interface PorterRequest {
	id: string;
	tripId: string;
	porterId: string;
	requestedBy: string;
	requestedRole: IntendedPorterRole;
	note: string | null;
	status: PorterRequestStatus;
	expiresAt: string;
	respondedAt: string | null;
	createdAt: string;
	updatedAt: string;
	trip?: {
		id: string;
		title: string;
		status: TripStatus;
		startsAt: string;
		endsAt: string;
		meetingAt: string | null;
	} | null;
	assignment?: {
		tripId: string;
		porterId: string;
		status: "assigned" | "pending_reconfirmation" | "unassigned";
	} | null;
}

export interface TripHost {
	id: string;
	fullName?: string | null;
	email?: string | null;
	phone?: string | null;
	bio?: string | null;
}

export interface TripDetails {
	id: string;
	hostId: string;
	host?: TripHost | null;
	routeId?: string;
	title: string;
	description: string | null;
	coverImageUrl: string | null;
	itinerary: Record<string, unknown> | null;
	includes: Record<string, unknown> | null;
	excludes: Record<string, unknown> | null;
	tripType: TripType;
	durationNights: number;
	startsAt: string;
	endsAt: string;
	meetingPoint: GeoJsonPoint;
	meetingAt: string | null;
	bookingDeadline: string;
	capacityMin: number;
	capacityMax: number | null;
	seatsTaken: number;
	remainingSeats: number | null;
	pricePerPerson: number;
	cancellationPolicy: Record<string, unknown> | null;
	status: TripStatus;
	cancellationReason: string | null;
	cancelledAt: string | null;
	difficulty?: TrekkingRouteDifficulty | null;
	weatherRiskLevel?: RiskLevel | null;
	registrationRisk?: TripRegistrationRisk;
	isBookable: boolean;
	createdAt: string;
	updatedAt: string;
	waypoints: TripWaypoint[];
}

export interface PorterAssignedTrip {
	tripId: string;
	title: string;
	status: TripStatus;
	startsAt: string;
	endsAt: string;
	routeName: string | null;
}

export interface PorterTripWaypoint {
	id: string;
	name: string;
	type: "start" | "checkpoint" | "rest" | "meal" | "activity" | "overnight" | "finish";
	dayNumber: number;
	sequenceOrder: number;
	plannedAt: string | null;
	durationMinutes: number | null;
	location: GeoJsonPoint;
}

export interface PorterTripOperations extends PorterAssignedTrip {
	assignmentStatus: "assigned";
	updatedAt: string;
	retrievedAt: string;
	meetingAt: string | null;
	meetingPoint: GeoJsonPoint | null;
	meetingPointName: string | null;
	waypoints: PorterTripWaypoint[];
	route: {
		id: string;
		name: string;
		status: RouteStatus;
		geometry: GeoJsonLineString;
		updatedAt: string;
		checkpoints: RouteCheckpoint[];
		dangerZones: RouteDangerZone[];
	} | null;
	members: Array<{
		memberId: string;
		displayName: string | null;
		memberStatus: "registered" | "joined" | "no_show" | "left";
	}>;
	weather: {
		availability: "recorded" | "stale" | "unavailable";
		maxAgeMinutes: number;
		record: {
			status: "success" | "failed";
			observedAt: string | null;
			fetchedAt: string;
			rainfallMm: number | null;
			windKph: number | null;
			temperatureC: number | null;
			visibilityM: number | null;
			thunderstorm: boolean | null;
			riskLevel: RiskLevel | null;
		} | null;
	};
	offlinePackage: { status: "unavailable"; downloadedAt: null };
	progress?: TripOperationalProgress | null;
}

export type TripPorterAssignmentStatus = "assigned" | "pending_reconfirmation" | "unassigned";

export interface HostPorterAssignment {
	porterId: string;
	displayName: string | null;
	email: string | null;
	status: TripPorterAssignmentStatus;
	assignedAt: string | null;
	reconfirmationDeadline: string | null;
	reconfirmedAt: string | null;
	declinedAt: string | null;
}

export interface HostPorterAssignmentTrip {
	id: string;
	title: string;
	status: TripStatus;
	startsAt: string;
	endsAt: string;
	assignedPorterCount: number;
	assignments: HostPorterAssignment[];
}

export type BookingBlockedReason =
	| "SOLD_OUT"
	| "DEADLINE_PASSED"
	| "TRIP_NOT_PUBLISHED"
	| "CONFLICT";

export interface BookTripInput {
	tripId: string;
	numPeople: number;
}

export interface BookTripResponse {
	id: string;
	tripId: string;
	userId: string;
	numPeople: number;
	status:
		| "pending_payment"
		| "pending_reconfirmation"
		| "confirmed"
		| "cancelled"
		| "expired"
		| "completed";
	paymentStatus: "not_required" | "unpaid" | "paid";
	holdExpiresAt: string | null;
	tripStartsAtSnapshot: string;
	tripEndsAtSnapshot: string;
	basePrice: string;
	totalAmount: string;
	cancellationPolicySnapshot: Record<string, unknown> | null;
	createdAt: string;
}

export interface TripBookingBooker {
	id: string;
	fullName: string | null;
	email: string | null;
	phone: string | null;
	avatarUrl?: string | null;
}

export interface TripBookingEquipmentItem {
	id: string;
	equipmentCatalogItemId: string;
	name: string;
	category: string;
	quantity: number;
	unitPrice: string;
	rentalDays: number;
	totalPrice: string;
}

export interface TripBookingMember {
	id: string;
	userId: string | null;
	displayName: string | null;
	email: string | null;
	isPrimary: boolean;
	memberStatus: string;
}

export interface TripBookingItem {
	id: string;
	tripId: string;
	userId: string;
	numPeople: number;
	status:
		| "pending_payment"
		| "pending_reconfirmation"
		| "confirmed"
		| "cancelled"
		| "expired"
		| "completed";
	paymentStatus: "not_required" | "unpaid" | "paid";
	basePrice: string | null;
	totalAmount: string | null;
	createdAt: string;
	completedAt: string | null;
	booker: TripBookingBooker;
	members: TripBookingMember[];
	equipmentItems: TripBookingEquipmentItem[];
}

export interface TripEquipmentPreparationItem {
	equipmentCatalogItemId: string;
	name: string;
	category: string;
	inventoryQuantity: number;
	totalQuantity: number;
	bookingCount: number;
}

export interface TripBookingsResponse {
	tripId: string;
	status: TripStatus;
	startsAt: string;
	bookings: TripBookingItem[];
	equipmentSummary: TripEquipmentPreparationItem[];
}

export interface BookedTripRouteMap {
	tripId: string;
	title: string;
	meetingPoint: GeoJsonPoint | null;
	route: PorterTripOperations["route"];
}

export interface MemberCheckpointVisit {
	memberId: string;
	userId: string | null;
	displayName: string | null;
	arrivedAt: string;
	capturedOffline: boolean;
}

export interface CheckpointProgressItem {
	checkpointId: string;
	name: string;
	type: "start" | "rest" | "water" | "dangerous" | "emergency_shelter" | "finish";
	routePosition: number;
	radiusMeters: number;
	status: "not_visited" | "arrival_confirmed";
	arrivedAt: string | null;
	confirmedById: string | null;
	visitedMembersCount: number;
	totalJoinedMembersCount: number;
	visits: MemberCheckpointVisit[];
}

export interface LastVisitedCheckpoint {
	checkpointId: string;
	name: string;
	arrivedAt: string;
	confirmedById: string;
}

export interface TripOperationalProgress {
	tripId: string;
	status: TripStatus;
	totalCheckpoints: number;
	visitedCheckpoints: number;
	progressPercentage: number;
	lastVisitedCheckpoint: LastVisitedCheckpoint | null;
	checkpoints: CheckpointProgressItem[];
}

export interface ConfirmCheckpointArrivalPayload {
	arrivedAt?: string;
	location?: GeoJsonPoint | null;
	memberIds?: string[];
	capturedOffline?: boolean;
	syncId?: string;
}

export interface SyncCheckpointArrivalItemPayload extends ConfirmCheckpointArrivalPayload {
	checkpointId: string;
}

export interface SyncCheckpointArrivalsPayload {
	arrivals: SyncCheckpointArrivalItemPayload[];
}

export interface LocalCheckpointArrivalRecord {
	id: string;
	tripId: string;
	checkpointId: string;
	checkpointName: string;
	porterId: string;
	arrivedAt: string;
	location: GeoJsonPoint | null;
	memberIds?: string[];
	syncStatus: "pending" | "syncing" | "failed";
	lastError?: string;
	createdAt: string;
}
