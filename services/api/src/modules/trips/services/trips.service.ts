import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	Optional,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { DEFAULT_CANCELLATION_POLICY } from "../../bookings/cancellation-policy";
import type { EventsGateway } from "../../realtime/events.gateway";
import { TrekkingRouteStatus } from "../../trekking-routes/entities/trekking-route.entity";
import { UserRole } from "../../users/entities/user.entity";
import type {
	ConfigureTripWaypointsDto,
	CreateTripDto,
	CreateTripWaypointDto,
	GeoJsonPointDto,
} from "../dto/create-trip.dto";
import type { HostPorterAssignmentTripDto } from "../dto/host-porter-assignment-response.dto";
import type { ListTripReviewsQueryDto } from "../dto/list-trip-reviews-query.dto";
import type { PorterAssignedTripResponseDto } from "../dto/porter-assigned-trip-response.dto";
import type { PorterTripOperationsResponseDto } from "../dto/porter-trip-operations-response.dto";
import type { CancelTripDto, RescheduleTripDto } from "../dto/reschedule-trip.dto";
import { ReviewTripAction, type ReviewTripDto } from "../dto/review-trip.dto";
import type { SearchTripsQueryDto } from "../dto/search-trips-query.dto";
import type {
	PaginatedTripReviewsResponseDto,
	PaginatedTripsResponseDto,
	TripResponseDto,
} from "../dto/trip-response.dto";
import { WaypointType } from "../entities/trip-waypoint.entity";
import { type GeoPoint, TripStatus, TripType } from "../entities/trip.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import {
	type CreateTripWaypointInput,
	type LockedTripForBooking,
	TripsRepository,
} from "../repositories/trips.repository";

interface FieldValidationError {
	field: string;
	errors: string[];
}

const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const TRIP_REVIEW_REMINDER_BEFORE_DEADLINE_MS = 60 * 60 * 1000;
const TRIP_REVIEW_AUTO_REJECT_REASON =
	"Trip was automatically rejected because it was not approved within 24 hours.";
const TRIP_BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";
const PORTER_WEATHER_MAX_AGE_MINUTES = 60;
const PUBLICLY_VIEWABLE_TRIP_STATUSES = new Set<TripStatus>([
	TripStatus.PUBLISHED,
	TripStatus.ONGOING,
	TripStatus.COMPLETED,
]);
const tripDateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: TRIP_BUSINESS_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

@Injectable()
export class TripsService {
	constructor(
		private readonly tripsRepository: TripsRepository,
		private readonly dataSource: DataSource,
		@Optional() private readonly eventsGateway?: EventsGateway
	) {}

	async search(query: SearchTripsQueryDto): Promise<PaginatedTripsResponseDto> {
		this.assertSearchTripsQuery(query);

		const startDate = query.startDate ? new Date(query.startDate) : undefined;
		const endDate = query.endDate ? new Date(query.endDate) : undefined;

		const { items, total } = await this.tripsRepository.searchPublishedTrips({
			search: query.search,
			tripType: query.tripType,
			difficulty: query.difficulty,
			startDate,
			endDate,
			minPrice: query.minPrice,
			maxPrice: query.maxPrice,
			routeId: query.routeId,
			province: query.province,
			city: query.city,
			page: query.page,
			limit: query.limit,
		});

		const totalPages = Math.ceil(total / query.limit);

		return {
			items,
			pagination: {
				page: query.page,
				limit: query.limit,
				total,
				totalPages,
			},
		};
	}

	async getTripDetails(actor: AuthenticatedUser, tripId: string): Promise<TripResponseDto> {
		const trip = await this.tripsRepository.findById(tripId);
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}

		const isOwningHost = trip.hostId === actor.userId;
		const isAdmin = actor.roles?.includes(UserRole.ADMIN) ?? false;

		// Ongoing/completed Trips stay viewable so booked Campers keep access once the schedule advances.
		if (!PUBLICLY_VIEWABLE_TRIP_STATUSES.has(trip.status) && !isOwningHost && !isAdmin) {
			throw new NotFoundException("Trip not found");
		}

		if (!isOwningHost && !isAdmin) {
			const sanitizedTrip = { ...trip };
			sanitizedTrip.routeId = undefined;
			return sanitizedTrip;
		}

		return trip;
	}

	async getMyTrips(hostId: string): Promise<TripResponseDto[]> {
		return this.tripsRepository.findTripsByHost(hostId);
	}

	async getUpcomingTripsWithoutPorter(hostId: string): Promise<TripResponseDto[]> {
		return this.tripsRepository.findUpcomingPorterCandidateTrips(hostId);
	}

	async getPorterAssignmentHistory(hostId: string): Promise<HostPorterAssignmentTripDto[]> {
		return this.tripsRepository.findPorterAssignmentHistoryByHost(hostId);
	}

	async getAssignedTrips(porterId: string): Promise<PorterAssignedTripResponseDto[]> {
		return this.tripsRepository.findAssignedTripsByPorter(porterId);
	}

	async getAssignedTripOperations(
		porterId: string,
		tripId: string
	): Promise<PorterTripOperationsResponseDto> {
		const row = await this.tripsRepository.findPorterTripOperations(porterId, tripId);
		if (!row) throw new NotFoundException("Assigned Trip not found");
		const { recordedWeather, retrievedAt, ...trip } = row;
		const maxAgeMinutes = PORTER_WEATHER_MAX_AGE_MINUTES;
		const observedAt = Date.parse(recordedWeather?.observedAt ?? "");
		const age = retrievedAt.getTime() - observedAt;
		const hasMeasurements =
			recordedWeather &&
			[
				recordedWeather.rainfallMm,
				recordedWeather.windKph,
				recordedWeather.temperatureC,
				recordedWeather.visibilityM,
			].every((value) => typeof value === "number" && Number.isFinite(value)) &&
			typeof recordedWeather.thunderstorm === "boolean";
		const unavailable =
			!recordedWeather ||
			recordedWeather.status !== "success" ||
			!hasMeasurements ||
			!Number.isFinite(age) ||
			age < 0;
		return {
			...trip,
			retrievedAt: retrievedAt.toISOString(),
			weather: {
				availability: unavailable
					? "unavailable"
					: age >= maxAgeMinutes * 60_000
						? "stale"
						: "recorded",
				maxAgeMinutes,
				record: unavailable ? null : recordedWeather,
			},
			offlinePackage: { status: "unavailable", downloadedAt: null },
		};
	}

	private assertSearchTripsQuery(query: SearchTripsQueryDto): void {
		const errors: FieldValidationError[] = [];

		if (query.startDate && query.endDate) {
			const start = new Date(query.startDate);
			const end = new Date(query.endDate);
			if (start > end) {
				errors.push({
					field: "endDate",
					errors: ["endDate must be after or equal to startDate"],
				});
			}
		}

		if (query.minPrice != null && query.maxPrice != null && query.minPrice > query.maxPrice) {
			errors.push({
				field: "minPrice",
				errors: ["minPrice must be less than or equal to maxPrice"],
			});
		}

		if (errors.length > 0) {
			throw this.validationException(errors);
		}
	}

	async create(hostId: string, dto: CreateTripDto): Promise<TripResponseDto> {
		const schedule = this.assertCreateTripPayload(dto);

		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.tripsRepository);
			const route = await repository.findRouteDependencyForUpdate(dto.routeId);

			if (!route) {
				throw new NotFoundException("Trekking route not found");
			}
			if (route.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can create a Trip for this Route");
			}
			if (route.status !== TrekkingRouteStatus.ACTIVE) {
				throw new ConflictException("Trip can be created only from an approved active Route");
			}

			const checkpointIds = dto.waypoints
				.map((waypoint) => waypoint.checkpointId)
				.filter((checkpointId): checkpointId is string => Boolean(checkpointId));
			const invalidCheckpointIds = await repository.findInvalidWaypointCheckpointIds(dto.routeId, [
				...new Set(checkpointIds),
			]);
			if (invalidCheckpointIds.length > 0) {
				throw this.validationException([
					{
						field: "waypoints.checkpointId",
						errors: [
							`checkpoint must exist on the selected Route: ${invalidCheckpointIds.join(", ")}`,
						],
					},
				]);
			}

			const trip = await repository.createDraft({
				hostId,
				routeId: dto.routeId,
				title: dto.title,
				description: dto.description ?? null,
				coverImageUrl: dto.coverImageUrl ?? null,
				itinerary: dto.itinerary ?? null,
				includes: dto.includes ?? null,
				excludes: dto.excludes ?? null,
				tripType: dto.tripType,
				durationNights: deriveDurationNights(dto.tripType, schedule.startsAt, schedule.endsAt),
				startsAt: schedule.startsAt,
				endsAt: schedule.endsAt,
				meetingPoint: toGeoPoint(dto.meetingPoint),
				meetingAt: schedule.meetingAt,
				bookingDeadline: schedule.bookingDeadline,
				capacityMin: dto.capacityMin,
				capacityMax: dto.capacityMax ?? null,
				pricePerPerson: dto.pricePerPerson,
				cancellationPolicy: (dto.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY) as Record<
					string,
					unknown
				>,
				waypoints: sortWaypointsByPlannedAt(dto.waypoints).map((waypoint, index) =>
					toWaypointInput(waypoint, index, schedule.startsAt)
				),
			});

			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trip.created",
				targetType: "trip",
				targetId: trip.id,
				before: null,
				after: this.buildAuditSnapshot(trip),
				reason: "host_create_trip",
			});

			return trip;
		});
	}

	async updateDraft(hostId: string, tripId: string, dto: CreateTripDto): Promise<TripResponseDto> {
		const schedule = this.assertCreateTripPayload(dto);

		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.tripsRepository);
			const lockedTrip = await repository.findByIdForWaypointConfiguration(tripId);

			if (!lockedTrip) {
				throw new NotFoundException("Trip not found");
			}
			if (lockedTrip.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can update this Trip");
			}
			if (
				lockedTrip.status !== TripStatus.DRAFT &&
				lockedTrip.status !== TripStatus.PENDING_APPROVAL
			) {
				throw new ConflictException("Only draft or pending_approval Trips can be edited");
			}

			const route = await repository.findRouteDependencyForUpdate(dto.routeId);
			if (!route) {
				throw new NotFoundException("Trekking route not found");
			}
			if (route.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can use this Route");
			}
			if (route.status !== TrekkingRouteStatus.ACTIVE) {
				throw new ConflictException("Trip can be updated only against an approved active Route");
			}

			const checkpointIds = dto.waypoints
				.map((waypoint) => waypoint.checkpointId)
				.filter((checkpointId): checkpointId is string => Boolean(checkpointId));
			const invalidCheckpointIds = await repository.findInvalidWaypointCheckpointIds(dto.routeId, [
				...new Set(checkpointIds),
			]);
			if (invalidCheckpointIds.length > 0) {
				throw this.validationException([
					{
						field: "waypoints.checkpointId",
						errors: [
							`checkpoint must exist on the selected Route: ${invalidCheckpointIds.join(", ")}`,
						],
					},
				]);
			}

			const updated = await repository.updateDraft(tripId, {
				hostId,
				routeId: dto.routeId,
				title: dto.title,
				description: dto.description ?? null,
				coverImageUrl: dto.coverImageUrl ?? null,
				itinerary: dto.itinerary ?? null,
				includes: dto.includes ?? null,
				excludes: dto.excludes ?? null,
				tripType: dto.tripType,
				durationNights: deriveDurationNights(dto.tripType, schedule.startsAt, schedule.endsAt),
				startsAt: schedule.startsAt,
				endsAt: schedule.endsAt,
				meetingPoint: toGeoPoint(dto.meetingPoint),
				meetingAt: schedule.meetingAt,
				bookingDeadline: schedule.bookingDeadline,
				capacityMin: dto.capacityMin,
				capacityMax: dto.capacityMax ?? null,
				pricePerPerson: dto.pricePerPerson,
				cancellationPolicy: (dto.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY) as Record<
					string,
					unknown
				>,
				waypoints: toDraftWaypointInputs(
					mergeEndpointWaypoints(lockedTrip.trip.waypoints, dto.waypoints),
					schedule.startsAt
				),
			});

			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trip.updated",
				targetType: "trip",
				targetId: tripId,
				before: this.buildAuditSnapshot(lockedTrip.trip),
				after: this.buildAuditSnapshot(updated),
				reason:
					lockedTrip.status === TripStatus.PENDING_APPROVAL
						? "host_update_trip_pending_approval"
						: "host_update_trip_draft",
			});

			return updated;
		});
	}

	async configureWaypoints(
		hostId: string,
		tripId: string,
		dto: ConfigureTripWaypointsDto
	): Promise<TripResponseDto> {
		const result = await this.dataSource.transaction(
			async (
				manager: EntityManager
			): Promise<{ trip: TripResponseDto; submittedForReview: boolean }> => {
				const repository = manager.withRepository(this.tripsRepository);
				const lockedTrip = await repository.findByIdForWaypointConfiguration(tripId);

				if (!lockedTrip) {
					throw new NotFoundException("Trip not found");
				}
				if (lockedTrip.hostId !== hostId) {
					throw new ForbiddenException("Only the owning Host can configure this Trip");
				}

				this.assertConfigurableTripStatus(lockedTrip.trip, dto);
				this.assertWaypointPayload(dto.waypoints, lockedTrip.trip, true);

				const checkpointIds = dto.waypoints
					.map((waypoint) => waypoint.checkpointId)
					.filter((checkpointId): checkpointId is string => Boolean(checkpointId));
				const invalidCheckpointIds = await repository.findInvalidWaypointCheckpointIds(
					lockedTrip.routeId,
					[...new Set(checkpointIds)]
				);
				if (invalidCheckpointIds.length > 0) {
					throw this.validationException([
						{
							field: "waypoints.checkpointId",
							errors: [
								`checkpoint must exist on the selected Route: ${invalidCheckpointIds.join(", ")}`,
							],
						},
					]);
				}

				if (
					lockedTrip.status === TripStatus.PENDING_APPROVAL &&
					waypointsMatchDto(lockedTrip.trip.waypoints, dto.waypoints)
				) {
					return { trip: lockedTrip.trip, submittedForReview: false };
				}

				const updated = await repository.replaceWaypointsAndSubmitForApproval(
					tripId,
					sortWaypointsByPlannedAt(dto.waypoints).map((waypoint, index) =>
						toWaypointInput(waypoint, index, new Date(lockedTrip.trip.startsAt))
					)
				);

				await manager.getRepository(AuditLog).save({
					actorId: hostId,
					action: "trip_waypoints.configured",
					targetType: "trip",
					targetId: tripId,
					before: this.buildWaypointAuditSnapshot(lockedTrip.trip),
					after: this.buildWaypointAuditSnapshot(updated),
					reason: "host_configure_trip_waypoints",
				});

				return {
					trip: updated,
					submittedForReview: lockedTrip.status !== TripStatus.PENDING_APPROVAL,
				};
			}
		);
		if (result.submittedForReview) this.emitTripReviewRequested(result.trip);
		return result.trip;
	}

	/** Adds one waypoint to an owned draft Trip. */
	createWaypoint(
		hostId: string,
		tripId: string,
		dto: CreateTripWaypointDto
	): Promise<TripResponseDto> {
		return this.mutateDraftWaypoints(hostId, tripId, "trip_waypoint.created", (current) => [
			...current,
			fromWaypointDto(dto),
		]);
	}

	/** Replaces the fields of one waypoint on an owned draft Trip. */
	updateWaypoint(
		hostId: string,
		tripId: string,
		waypointId: string,
		dto: CreateTripWaypointDto
	): Promise<TripResponseDto> {
		return this.mutateDraftWaypoints(hostId, tripId, "trip_waypoint.updated", (current) => {
			const existing = current.find((waypoint) => waypoint.id === waypointId);
			if (!existing) throw new NotFoundException("Waypoint not found");
			if (
				(isEndpointType(existing.type) || isEndpointType(dto.type)) &&
				dto.type !== existing.type
			) {
				throw new ConflictException("Start and finish waypoints cannot change type");
			}
			return current.map((waypoint) =>
				waypoint.id === waypointId ? fromWaypointDto(dto, waypointId) : waypoint
			);
		});
	}

	/** Removes one waypoint from an owned draft Trip; start and finish must stay. */
	deleteWaypoint(hostId: string, tripId: string, waypointId: string): Promise<TripResponseDto> {
		return this.mutateDraftWaypoints(hostId, tripId, "trip_waypoint.deleted", (current) => {
			const existing = current.find((waypoint) => waypoint.id === waypointId);
			if (!existing) throw new NotFoundException("Waypoint not found");
			if (isEndpointType(existing.type)) {
				throw new ConflictException("Start and finish waypoints cannot be deleted");
			}
			return current.filter((waypoint) => waypoint.id !== waypointId);
		});
	}

	/** Submits an owned draft Trip for approval using the waypoints already stored for it. */
	async submitForApproval(hostId: string, tripId: string): Promise<TripResponseDto> {
		const result = await this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.tripsRepository);
			const lockedTrip = await repository.findByIdForWaypointConfiguration(tripId);
			if (!lockedTrip) throw new NotFoundException("Trip not found");
			if (lockedTrip.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can submit this Trip");
			}
			if (lockedTrip.status === TripStatus.PENDING_APPROVAL) {
				return { trip: lockedTrip.trip, submitted: false };
			}
			if (lockedTrip.status !== TripStatus.DRAFT) {
				throw new ConflictException("Only draft Trips can be submitted for approval");
			}

			const stored = lockedTrip.trip.waypoints.map(fromStoredWaypoint);
			const missingTime = stored.findIndex((waypoint) => waypoint.plannedAt === null);
			if (missingTime >= 0) {
				throw this.validationException([
					{ field: `waypoints.${missingTime}.plannedAt`, errors: ["plannedAt is required"] },
				]);
			}
			this.assertWaypointPayload(stored.map(toWaypointDto), lockedTrip.trip, true);

			const updated = await repository.submitDraftForApproval(tripId);
			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trip.submitted_for_approval",
				targetType: "trip",
				targetId: tripId,
				before: { status: lockedTrip.status },
				after: this.buildWaypointAuditSnapshot(updated),
				reason: "host_submit_trip_for_approval",
			});
			return { trip: updated, submitted: true };
		});
		if (result.submitted) this.emitTripReviewRequested(result.trip);
		return result.trip;
	}

	private mutateDraftWaypoints(
		hostId: string,
		tripId: string,
		action: string,
		mutate: (current: DraftWaypoint[]) => DraftWaypoint[]
	): Promise<TripResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.tripsRepository);
			const lockedTrip = await repository.findByIdForWaypointConfiguration(tripId);
			if (!lockedTrip) throw new NotFoundException("Trip not found");
			if (lockedTrip.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can configure this Trip");
			}
			if (lockedTrip.status !== TripStatus.DRAFT) {
				throw new ConflictException("Only draft Trips can change waypoints");
			}

			const next = mutate(lockedTrip.trip.waypoints.map(fromStoredWaypoint));
			this.assertDraftWaypoints(next, lockedTrip.trip);

			const checkpointIds = next
				.map((waypoint) => waypoint.checkpointId)
				.filter((checkpointId): checkpointId is string => Boolean(checkpointId));
			const invalidCheckpointIds = await repository.findInvalidWaypointCheckpointIds(
				lockedTrip.routeId,
				[...new Set(checkpointIds)]
			);
			if (invalidCheckpointIds.length > 0) {
				throw this.validationException([
					{
						field: "waypoints.checkpointId",
						errors: [
							`checkpoint must exist on the selected Route: ${invalidCheckpointIds.join(", ")}`,
						],
					},
				]);
			}

			const updated = await repository.saveDraftWaypoints(
				tripId,
				toDraftWaypointInputs(next, new Date(lockedTrip.trip.startsAt))
			);
			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action,
				targetType: "trip",
				targetId: tripId,
				before: this.buildWaypointAuditSnapshot(lockedTrip.trip),
				after: this.buildWaypointAuditSnapshot(updated),
				reason: "host_edit_draft_trip_waypoints",
			});
			return updated;
		});
	}

	/** Rules every saved draft must satisfy; completeness (start/finish order, nights) is checked on submit. */
	private assertDraftWaypoints(
		waypoints: DraftWaypoint[],
		trip: Pick<TripResponseDto, "startsAt" | "endsAt" | "tripType">
	): void {
		const errors: FieldValidationError[] = [];
		const startsAt = new Date(trip.startsAt).getTime();
		const endsAt = new Date(trip.endsAt).getTime();
		const plannedTimes = new Set<number>();
		for (const [index, waypoint] of waypoints.entries()) {
			if (!waypoint.plannedAt) continue;
			const plannedAt = waypoint.plannedAt.getTime();
			if (plannedTimes.has(plannedAt)) {
				errors.push({
					field: `waypoints.${index}.plannedAt`,
					errors: ["plannedAt must be unique within the Trip"],
				});
			}
			plannedTimes.add(plannedAt);
			if (plannedAt < startsAt || plannedAt > endsAt) {
				errors.push({
					field: `waypoints.${index}.plannedAt`,
					errors: ["plannedAt must be within the Trip schedule"],
				});
			}
		}
		for (const type of [WaypointType.START, WaypointType.FINISH]) {
			if (waypoints.filter((waypoint) => waypoint.type === type).length > 1) {
				errors.push({ field: "waypoints", errors: [`Trip can include only one ${type} waypoint`] });
			}
		}
		if (
			trip.tripType === TripType.DAY_TRIP &&
			waypoints.some((waypoint) => waypoint.type === WaypointType.OVERNIGHT)
		) {
			errors.push({ field: "waypoints", errors: ["day_trip cannot include overnight waypoints"] });
		}
		if (errors.length > 0) throw this.validationException(errors);
	}

	/**
	 * CTMS-023-T02. Mirrors TrekkingRoutesService.listPendingReview -- the
	 * Admin review UI needs a way to discover which Trips are awaiting
	 * approval before it can call `review` on any of them.
	 */
	listPendingReview(): Promise<TripResponseDto[]> {
		return this.tripsRepository.findPendingReview();
	}

	async listAdminReviews(query: ListTripReviewsQueryDto): Promise<PaginatedTripReviewsResponseDto> {
		const { items, total } = await this.tripsRepository.findAdminReviews(
			query.reviewOutcome,
			query.page,
			query.limit
		);
		return {
			items,
			pagination: {
				page: query.page,
				limit: query.limit,
				total,
				totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
			},
		};
	}

	async processPendingReviewDeadlines(now = new Date()): Promise<{
		reminded: number;
		rejected: number;
	}> {
		const expiresBefore = new Date(now.getTime() - TWENTY_FOUR_HOURS_IN_MILLISECONDS);
		const reminderStartsBefore = new Date(
			now.getTime() - (TWENTY_FOUR_HOURS_IN_MILLISECONDS - TRIP_REVIEW_REMINDER_BEFORE_DEADLINE_MS)
		);
		const reminders = await this.tripsRepository.findPendingReviewReminderCandidates(
			reminderStartsBefore,
			expiresBefore
		);
		let reminded = 0;
		for (const trip of reminders) {
			await this.dataSource.transaction(async (manager: EntityManager) => {
				await manager.getRepository(AuditLog).save({
					actorId: null,
					action: "trip.review.reminder_sent",
					targetType: "trip",
					targetId: trip.id,
					before: { status: TripStatus.PENDING_APPROVAL },
					after: {
						status: TripStatus.PENDING_APPROVAL,
						reviewedUpdatedAt: trip.updatedAt,
						deadlineAt: this.reviewDeadlineAt(trip.updatedAt),
					},
					reason: "admin_review_deadline_reminder",
				});
			});
			reminded += 1;
			this.emitTripReviewReminder(trip);
		}

		const expired = await this.tripsRepository.findExpiredPendingReviewCandidates(expiresBefore);
		let rejected = 0;
		for (const trip of expired) {
			const updated = await this.autoRejectPendingReviewTrip(trip.id, now);
			if (updated) {
				rejected += 1;
				this.emitTripReviewAutoRejected(updated, now);
			}
		}

		return { reminded, rejected };
	}

	/**
	 * CTMS-023-T01. Mirrors TrekkingRoutesService.review's own action+reason
	 * flow (the proven Admin-review convention already used for CTMS-13):
	 * only a Trip in pending_approval may be reviewed; approve requires the
	 * referenced Route to still be active (BR-037's "bind to an approved
	 * Route" requirement -- a Route can be closed after a Trip was submitted
	 * for approval, and that must block publishing), decline always requires
	 * a reason and returns the Trip to draft for the Host to revise.
	 */
	async review(adminId: string, tripId: string, dto: ReviewTripDto): Promise<TripResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.tripsRepository);
			const locked = await repository.findByIdForReview(tripId);

			if (!locked) {
				throw new NotFoundException("Trip not found");
			}
			if (locked.status !== TripStatus.PENDING_APPROVAL) {
				throw new ConflictException("Only Trips in pending_approval status can be reviewed");
			}
			if (normalizeDate(locked.trip.updatedAt) !== normalizeDate(dto.reviewedUpdatedAt)) {
				throw new ConflictException(
					"Trip has changed since this review copy was loaded. Please reload and review the latest version."
				);
			}

			if (dto.action === ReviewTripAction.APPROVE) {
				const routeStatus = await repository.findRouteStatus(locked.routeId);
				if (routeStatus !== TrekkingRouteStatus.ACTIVE) {
					throw this.validationException([
						{
							field: "routeId",
							errors: ["the Trip's Route is no longer active and cannot be published against"],
						},
					]);
				}
			}

			const targetStatus =
				dto.action === ReviewTripAction.APPROVE ? TripStatus.PUBLISHED : TripStatus.DRAFT;
			const updated = await repository.updateStatus(tripId, targetStatus);

			await manager.getRepository(AuditLog).save({
				actorId: adminId,
				action: dto.action === ReviewTripAction.APPROVE ? "trip.approved" : "trip.declined",
				targetType: "trip",
				targetId: tripId,
				before: { status: locked.status },
				after: { status: targetStatus },
				reason: dto.action === ReviewTripAction.APPROVE ? null : (dto.reason ?? null),
			});

			return updated;
		});
	}

	private async autoRejectPendingReviewTrip(
		tripId: string,
		rejectedAt: Date
	): Promise<TripResponseDto | null> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.tripsRepository);
			const locked = await repository.findByIdForReview(tripId);
			if (!locked || locked.status !== TripStatus.PENDING_APPROVAL) return null;

			const deadlineAt = new Date(
				new Date(locked.trip.updatedAt).getTime() + TWENTY_FOUR_HOURS_IN_MILLISECONDS
			);
			if (deadlineAt > rejectedAt) return null;

			const updated = await repository.updateStatus(tripId, TripStatus.REJECTED);
			await manager.getRepository(AuditLog).save({
				actorId: null,
				action: "trip.auto_rejected",
				targetType: "trip",
				targetId: tripId,
				before: { status: TripStatus.PENDING_APPROVAL },
				after: {
					status: TripStatus.REJECTED,
					rejectedAt,
					deadlineAt,
				},
				reason: TRIP_REVIEW_AUTO_REJECT_REASON,
			});
			return updated;
		});
	}

	async reschedule(
		hostId: string,
		tripId: string,
		dto: RescheduleTripDto,
		rescheduledAt = new Date()
	): Promise<TripResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.tripsRepository);
			const locked = await repository.findByIdForScheduleChange(tripId);

			if (!locked) {
				throw new NotFoundException("Trip not found");
			}
			if (locked.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can reschedule this Trip");
			}
			if (locked.status !== TripStatus.PUBLISHED) {
				throw new ConflictException("Only published Trips can be rescheduled");
			}
			if (locked.startsAt <= rescheduledAt) {
				throw new ConflictException("Trip has already started");
			}

			const { startsAt, endsAt } = this.assertReschedulePayload(dto, locked, rescheduledAt);
			const reconfirmationDeadline = new Date(
				startsAt.getTime() - TWENTY_FOUR_HOURS_IN_MILLISECONDS
			);
			const before = this.buildScheduleAuditSnapshot(locked.trip);
			const commitmentSummary = await repository.reschedulePublishedTrip(
				tripId,
				startsAt,
				endsAt,
				rescheduledAt,
				reconfirmationDeadline
			);
			const updated = await repository.findById(tripId);
			if (!updated) throw new Error("Failed to load rescheduled Trip");

			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trip.rescheduled",
				targetType: "trip",
				targetId: tripId,
				before,
				after: {
					...this.buildScheduleAuditSnapshot(updated),
					rescheduledAt,
					reconfirmationDeadline,
					commitmentSummary,
				},
				reason: "host_reschedule_trip",
			});

			return updated;
		});
	}

	async cancel(hostId: string, tripId: string, dto: CancelTripDto): Promise<TripResponseDto> {
		const cancelledAt = new Date();
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.tripsRepository);
			const locked = await repository.findByIdForScheduleChange(tripId);

			if (!locked) {
				throw new NotFoundException("Trip not found");
			}
			if (locked.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can cancel this Trip");
			}
			if (locked.status === TripStatus.COMPLETED) {
				throw new ConflictException("Completed Trips cannot be cancelled");
			}
			if (locked.status === TripStatus.CANCELLED) {
				throw new ConflictException("Trip is already cancelled");
			}

			const before = this.buildAuditSnapshot(locked.trip);
			const commitmentSummary = await repository.cancelTripWithCommitments(
				tripId,
				cancelledAt,
				dto.reason
			);
			const updated = await repository.findById(tripId);
			if (!updated) throw new Error("Failed to load cancelled Trip");

			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trip.cancelled",
				targetType: "trip",
				targetId: tripId,
				before,
				after: {
					...this.buildAuditSnapshot(updated),
					cancelledAt,
					commitmentSummary,
				},
				reason: dto.reason,
			});

			return updated;
		});
	}

	/**
	 * CTMS-024 – BR-067, BR-068, BR-071, BR-072, BR-175, BR-176, BR-177, BR-179.
	 *
	 * Reserves `numPeople` seats on the given trip inside the caller's active
	 * transaction.  The method:
	 *   1. Acquires a row-level FOR UPDATE lock on the trip row so that
	 *      concurrent booking requests for the same trip_id are serialised
	 *      (BR-068, BR-179).
	 *   2. Validates that the trip is bookable (published, before booking
	 *      deadline, seats available) before any write (BR-175, BR-211).
	 *   3. Increments seats_taken by numPeople inside the same transaction so
	 *      the DB constraint acts as a final guard (BR-071, BR-177).
	 *
	 * Callers (the Booking module) MUST wrap this call in a DataSource
	 * transaction.  The `manager` parameter is the active EntityManager from
	 * that transaction.  Any exception rolls back the full transaction
	 * (BR-072, BR-176).
	 *
	 * Returns the locked trip snapshot for downstream use (price, host, etc.).
	 */
	async reserveSeats(
		tripId: string,
		numPeople: number,
		manager: EntityManager
	): Promise<LockedTripForBooking> {
		const repository = manager.withRepository(this.tripsRepository);
		const locked = await repository.findByIdForBooking(tripId);

		if (!locked) {
			throw new NotFoundException("Trip not found");
		}
		if (locked.status !== TripStatus.PUBLISHED) {
			throw new ConflictException("Trip is not available for booking");
		}

		const now = new Date();
		if (new Date(locked.bookingDeadline) <= now) {
			throw new ConflictException("Booking deadline has passed");
		}

		// Application-layer overbooking guard (BR-071): check remaining seats
		// before the DB constraint fires so we can return a clear 409 rather
		// than a raw constraint violation.
		if (locked.capacityMax !== null && locked.seatsTaken + numPeople > locked.capacityMax) {
			throw new ConflictException(
				`Trip is fully booked: only ${locked.capacityMax - locked.seatsTaken} seat(s) remaining`
			);
		}

		await repository.adjustSeatsTaken(tripId, numPeople);

		return locked;
	}

	/**
	 * CTMS-024 – BR-067, BR-069, BR-070.
	 *
	 * Releases previously reserved seats when a booking is cancelled or expires.
	 * Reconciles seats_taken from the authoritative bookings table instead of
	 * using a simple decrement to guarantee correctness across retries, partial
	 * failures, and rollback scenarios (BR-177).
	 *
	 * Must be called inside an active TypeORM transaction that already holds the
	 * row lock on the trip (acquired by the caller before modifying the booking
	 * status).
	 */
	async releaseSeats(tripId: string, manager: EntityManager): Promise<void> {
		const repository = manager.withRepository(this.tripsRepository);
		await repository.recomputeSeatsTaken(tripId);
	}

	private assertCreateTripPayload(dto: CreateTripDto): {
		startsAt: Date;
		endsAt: Date;
		bookingDeadline: Date;
		meetingAt: Date | null;
	} {
		const errors: FieldValidationError[] = [];
		const startsAt = new Date(dto.startsAt);
		const endsAt = new Date(dto.endsAt);
		const bookingDeadline = new Date(dto.bookingDeadline);
		const meetingAt = dto.meetingAt ? new Date(dto.meetingAt) : null;

		if (startsAt >= endsAt) {
			errors.push({ field: "endsAt", errors: ["endsAt must be after startsAt"] });
		}
		if (dto.tripType === TripType.DAY_TRIP && !isSameTripBusinessDate(startsAt, endsAt)) {
			errors.push({
				field: "endsAt",
				errors: ["day_trip must start and end on the same date"],
			});
		}
		if (bookingDeadline >= startsAt) {
			errors.push({
				field: "bookingDeadline",
				errors: ["bookingDeadline must be before startsAt"],
			});
		}
		if (meetingAt && meetingAt > startsAt) {
			errors.push({
				field: "meetingAt",
				errors: ["meetingAt must be before or equal to startsAt"],
			});
		}
		if (dto.capacityMax != null && dto.capacityMin > dto.capacityMax) {
			errors.push({
				field: "capacityMin",
				errors: ["capacityMin must be less than or equal to capacityMax"],
			});
		}

		this.assertWaypointPayload(
			dto.waypoints,
			{
				startsAt,
				endsAt,
				tripType: dto.tripType,
				waypoints: [],
			},
			false
		);

		if (errors.length > 0) {
			throw this.validationException(errors);
		}

		return { startsAt, endsAt, bookingDeadline, meetingAt };
	}

	private assertWaypointPayload(
		waypoints: CreateTripWaypointDto[],
		trip: Pick<TripResponseDto, "startsAt" | "endsAt" | "tripType" | "waypoints">,
		requireApprovalReady: boolean
	): void {
		const errors: FieldValidationError[] = [];
		const startsAt = new Date(trip.startsAt);
		const endsAt = new Date(trip.endsAt);
		const plannedTimes = new Set<string>();

		for (const [index, waypoint] of waypoints.entries()) {
			const plannedAt = new Date(waypoint.plannedAt);
			const normalizedPlannedAt = plannedAt.toISOString();
			if (plannedTimes.has(normalizedPlannedAt)) {
				errors.push({
					field: `waypoints.${index}.plannedAt`,
					errors: ["plannedAt must be unique within the Trip"],
				});
			}
			plannedTimes.add(normalizedPlannedAt);

			if (plannedAt < startsAt || plannedAt > endsAt) {
				errors.push({
					field: `waypoints.${index}.plannedAt`,
					errors: ["plannedAt must be within the Trip schedule"],
				});
			}
		}

		const sortedWaypoints = sortWaypointsByPlannedAt(waypoints);
		const startCount = waypoints.filter((waypoint) => waypoint.type === WaypointType.START).length;
		const finishCount = waypoints.filter(
			(waypoint) => waypoint.type === WaypointType.FINISH
		).length;
		const overnightCount = waypoints.filter(
			(waypoint) => waypoint.type === WaypointType.OVERNIGHT
		).length;

		if (startCount !== 1) {
			errors.push({ field: "waypoints", errors: ["Trip must include a start waypoint"] });
		}
		if (finishCount !== 1) {
			errors.push({ field: "waypoints", errors: ["Trip must include a finish waypoint"] });
		}
		if (sortedWaypoints[0]?.type !== WaypointType.START) {
			errors.push({
				field: "waypoints",
				errors: ["start waypoint must be the earliest planned waypoint"],
			});
		}
		if (sortedWaypoints.at(-1)?.type !== WaypointType.FINISH) {
			errors.push({
				field: "waypoints",
				errors: ["finish waypoint must be the latest planned waypoint"],
			});
		}
		if (trip.tripType === TripType.DAY_TRIP && overnightCount > 0) {
			errors.push({
				field: "waypoints",
				errors: ["day_trip cannot include overnight waypoints"],
			});
		}
		if (requireApprovalReady && trip.tripType === TripType.OVERNIGHT && overnightCount === 0) {
			errors.push({
				field: "waypoints",
				errors: ["overnight Trips must include at least one overnight waypoint"],
			});
		}
		if (errors.length > 0) {
			throw this.validationException(errors);
		}
	}

	private assertConfigurableTripStatus(
		trip: TripResponseDto,
		dto: ConfigureTripWaypointsDto
	): void {
		if (trip.status === TripStatus.DRAFT) return;
		if (
			trip.status === TripStatus.PENDING_APPROVAL &&
			waypointsMatchDto(trip.waypoints, dto.waypoints)
		) {
			return;
		}
		throw new ConflictException("Only draft Trips can be configured and submitted for approval");
	}

	private validationException(message: FieldValidationError[]): UnprocessableEntityException {
		return new UnprocessableEntityException({
			statusCode: 422,
			error: "Unprocessable Entity",
			message,
		});
	}

	private assertReschedulePayload(
		dto: RescheduleTripDto,
		trip: {
			startsAt: Date;
			endsAt: Date;
			meetingAt: Date | null;
			tripType: TripType;
		},
		rescheduledAt: Date
	): { startsAt: Date; endsAt: Date } {
		const errors: FieldValidationError[] = [];
		if (!dto.startsAt && !dto.endsAt) {
			errors.push({
				field: "startsAt",
				errors: ["startsAt or endsAt is required"],
			});
		}

		const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date(trip.startsAt);
		const endsAt = dto.endsAt ? new Date(dto.endsAt) : new Date(trip.endsAt);
		if (
			startsAt.getTime() === trip.startsAt.getTime() &&
			endsAt.getTime() === trip.endsAt.getTime()
		) {
			errors.push({
				field: "startsAt",
				errors: ["new schedule must change startsAt or endsAt"],
			});
		}
		if (startsAt <= new Date(rescheduledAt.getTime() + TWENTY_FOUR_HOURS_IN_MILLISECONDS)) {
			errors.push({
				field: "startsAt",
				errors: ["startsAt must be more than 24 hours after the reschedule time"],
			});
		}
		if (startsAt >= endsAt) {
			errors.push({ field: "endsAt", errors: ["endsAt must be after startsAt"] });
		}
		if (trip.tripType === TripType.DAY_TRIP && !isSameTripBusinessDate(startsAt, endsAt)) {
			errors.push({
				field: "endsAt",
				errors: ["day_trip must start and end on the same date"],
			});
		}
		if (trip.meetingAt && trip.meetingAt > startsAt) {
			errors.push({
				field: "startsAt",
				errors: ["startsAt must be after or equal to the current meetingAt"],
			});
		}

		if (errors.length > 0) {
			throw this.validationException(errors);
		}
		return { startsAt, endsAt };
	}

	private buildAuditSnapshot(trip: TripResponseDto): Record<string, unknown> {
		return {
			id: trip.id,
			hostId: trip.hostId,
			routeId: trip.routeId,
			title: trip.title,
			tripType: trip.tripType,
			durationNights: trip.durationNights,
			startsAt: trip.startsAt,
			endsAt: trip.endsAt,
			bookingDeadline: trip.bookingDeadline,
			capacityMin: trip.capacityMin,
			capacityMax: trip.capacityMax,
			seatsTaken: trip.seatsTaken,
			pricePerPerson: trip.pricePerPerson,
			status: trip.status,
			waypointCount: trip.waypoints.length,
			updatedAt: trip.updatedAt,
		};
	}

	private buildWaypointAuditSnapshot(trip: TripResponseDto): Record<string, unknown> {
		return {
			id: trip.id,
			hostId: trip.hostId,
			routeId: trip.routeId,
			status: trip.status,
			waypoints: trip.waypoints.map((waypoint) => ({
				checkpointId: waypoint.checkpointId,
				type: waypoint.type,
				name: waypoint.name,
				plannedAt: waypoint.plannedAt,
			})),
		};
	}

	private buildScheduleAuditSnapshot(trip: TripResponseDto): Record<string, unknown> {
		return {
			id: trip.id,
			hostId: trip.hostId,
			status: trip.status,
			startsAt: trip.startsAt,
			endsAt: trip.endsAt,
		};
	}

	private reviewDeadlineAt(reviewedUpdatedAt: Date | string): string {
		return new Date(
			new Date(reviewedUpdatedAt).getTime() + TWENTY_FOUR_HOURS_IN_MILLISECONDS
		).toISOString();
	}

	private emitTripReviewRequested(trip: TripResponseDto): void {
		this.eventsGateway?.emitTripReviewRequested({
			tripId: trip.id,
			title: trip.title,
			hostId: trip.hostId,
			submittedAt: new Date(trip.updatedAt).toISOString(),
			deadlineAt: this.reviewDeadlineAt(trip.updatedAt),
		});
	}

	private emitTripReviewReminder(trip: {
		id: string;
		title: string;
		hostId: string;
		updatedAt: Date;
	}): void {
		this.eventsGateway?.emitTripReviewReminder({
			tripId: trip.id,
			title: trip.title,
			hostId: trip.hostId,
			submittedAt: trip.updatedAt.toISOString(),
			deadlineAt: this.reviewDeadlineAt(trip.updatedAt),
		});
	}

	private emitTripReviewAutoRejected(trip: TripResponseDto, rejectedAt: Date): void {
		this.eventsGateway?.emitTripReviewAutoRejected({
			tripId: trip.id,
			title: trip.title,
			hostId: trip.hostId,
			rejectedAt: rejectedAt.toISOString(),
			reason: TRIP_REVIEW_AUTO_REJECT_REASON,
		});
	}
}

function toGeoPoint(point: GeoJsonPointDto): GeoPoint {
	return {
		type: "Point",
		coordinates: point.coordinates,
	};
}

function deriveDurationNights(tripType: TripType, startsAt: Date, endsAt: Date): number {
	if (tripType === TripType.DAY_TRIP) return 0;

	const durationMs = endsAt.getTime() - startsAt.getTime();
	return Math.max(1, Math.ceil(durationMs / ONE_DAY_IN_MILLISECONDS));
}

function isSameTripBusinessDate(firstDate: Date, secondDate: Date): boolean {
	return tripDateFormatter.format(firstDate) === tripDateFormatter.format(secondDate);
}

interface DraftWaypoint {
	id?: string;
	checkpointId: string | null;
	type: WaypointType;
	name: string;
	location: GeoPoint;
	plannedAt: Date | null;
	metadata: Record<string, unknown> | null;
}

function isEndpointType(type: WaypointType): boolean {
	return type === WaypointType.START || type === WaypointType.FINISH;
}

function fromStoredWaypoint(waypoint: TripResponseDto["waypoints"][number]): DraftWaypoint {
	return {
		id: waypoint.id,
		checkpointId: waypoint.checkpointId ?? null,
		type: waypoint.type,
		name: waypoint.name,
		location: waypoint.location,
		plannedAt: waypoint.plannedAt ? new Date(waypoint.plannedAt) : null,
		metadata: waypoint.metadata ?? null,
	};
}

function fromWaypointDto(dto: CreateTripWaypointDto, id?: string): DraftWaypoint {
	return {
		id,
		checkpointId: dto.checkpointId ?? null,
		type: dto.type,
		name: dto.name,
		location: toGeoPoint(dto.location),
		plannedAt: new Date(dto.plannedAt),
		metadata: dto.metadata ?? null,
	};
}

/** Converts a fully scheduled stored waypoint back into the payload shape the submit rules check. */
function toWaypointDto(waypoint: DraftWaypoint): CreateTripWaypointDto {
	return {
		...(waypoint.checkpointId ? { checkpointId: waypoint.checkpointId } : {}),
		type: waypoint.type,
		name: waypoint.name,
		location: waypoint.location,
		plannedAt: (waypoint.plannedAt as Date).toISOString(),
		...(waypoint.metadata ? { metadata: waypoint.metadata } : {}),
	} as CreateTripWaypointDto;
}

/** Orders waypoints by planned time (unscheduled ones last) and derives day and sequence. */
function toDraftWaypointInputs(
	waypoints: DraftWaypoint[],
	tripStartsAt: Date
): CreateTripWaypointInput[] {
	return [...waypoints]
		.sort(
			(first, second) =>
				(first.plannedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
				(second.plannedAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
		)
		.map((waypoint, index) => ({
			id: waypoint.id,
			checkpointId: waypoint.checkpointId,
			type: waypoint.type,
			name: waypoint.name,
			location: waypoint.location,
			dayNumber: waypoint.plannedAt ? deriveWaypointDayNumber(tripStartsAt, waypoint.plannedAt) : 1,
			sequenceOrder: index + 1,
			plannedAt: waypoint.plannedAt,
			durationMinutes: null,
			metadata: waypoint.metadata,
		}));
}

/**
 * Trip info edits only carry the start/finish waypoints; keep the stop waypoints the Host
 * configured separately. A payload that includes stop waypoints stays authoritative.
 */
function mergeEndpointWaypoints(
	stored: TripResponseDto["waypoints"],
	incoming: CreateTripWaypointDto[]
): DraftWaypoint[] {
	if (incoming.some((waypoint) => !isEndpointType(waypoint.type)))
		return incoming.map((waypoint) => fromWaypointDto(waypoint));
	const endpointIds = new Map<WaypointType, string>();
	for (const waypoint of stored)
		if (isEndpointType(waypoint.type)) endpointIds.set(waypoint.type, waypoint.id);
	return [
		...incoming.map((waypoint) => fromWaypointDto(waypoint, endpointIds.get(waypoint.type))),
		...stored.filter((waypoint) => !isEndpointType(waypoint.type)).map(fromStoredWaypoint),
	];
}

function toWaypointInput(
	waypoint: CreateTripWaypointDto,
	index: number,
	tripStartsAt: Date
): CreateTripWaypointInput {
	const plannedAt = new Date(waypoint.plannedAt);
	return {
		checkpointId: waypoint.checkpointId ?? null,
		type: waypoint.type,
		name: waypoint.name,
		location: toGeoPoint(waypoint.location),
		dayNumber: deriveWaypointDayNumber(tripStartsAt, plannedAt),
		sequenceOrder: index + 1,
		plannedAt,
		durationMinutes: null,
		metadata: waypoint.metadata ?? null,
	};
}

function waypointsMatchDto(
	currentWaypoints: TripResponseDto["waypoints"],
	incomingWaypoints: CreateTripWaypointDto[]
): boolean {
	if (currentWaypoints.length !== incomingWaypoints.length) return false;

	const currentBySchedule = [...currentWaypoints].sort(
		(first, second) =>
			new Date(first.plannedAt ?? 0).getTime() - new Date(second.plannedAt ?? 0).getTime()
	);
	const incomingBySchedule = [...incomingWaypoints].sort(
		(first, second) => new Date(first.plannedAt).getTime() - new Date(second.plannedAt).getTime()
	);

	return currentBySchedule.every((current, index) => {
		const incoming = incomingBySchedule[index];
		return (
			current.checkpointId === (incoming.checkpointId ?? null) &&
			current.type === incoming.type &&
			current.name === incoming.name &&
			coordinatesMatch(current.location.coordinates, incoming.location.coordinates) &&
			normalizeDate(current.plannedAt) === normalizeDate(incoming.plannedAt) &&
			JSON.stringify(current.metadata ?? null) === JSON.stringify(incoming.metadata ?? null)
		);
	});
}

function deriveWaypointDayNumber(tripStartsAt: Date, plannedAt: Date): number {
	const startDate = new Date(
		tripStartsAt.getFullYear(),
		tripStartsAt.getMonth(),
		tripStartsAt.getDate()
	);
	const plannedDate = new Date(plannedAt.getFullYear(), plannedAt.getMonth(), plannedAt.getDate());
	return Math.max(
		1,
		Math.floor((plannedDate.getTime() - startDate.getTime()) / ONE_DAY_IN_MILLISECONDS) + 1
	);
}

function coordinatesMatch(first: [number, number], second: [number, number]): boolean {
	return first[0] === second[0] && first[1] === second[1];
}

function normalizeDate(value: Date | string | undefined | null): string | null {
	if (!value) return null;
	return new Date(value).toISOString();
}

function sortWaypointsByPlannedAt<T extends { plannedAt: string }>(waypoints: T[]): T[] {
	return [...waypoints].sort(
		(first, second) => new Date(first.plannedAt).getTime() - new Date(second.plannedAt).getTime()
	);
}
