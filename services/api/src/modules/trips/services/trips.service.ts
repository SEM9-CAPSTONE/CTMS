import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { TrekkingRouteStatus } from "../../trekking-routes/entities/trekking-route.entity";
import type {
	ConfigureTripWaypointsDto,
	CreateTripDto,
	CreateTripWaypointDto,
	GeoJsonPointDto,
} from "../dto/create-trip.dto";
import { ReviewTripAction, type ReviewTripDto } from "../dto/review-trip.dto";
import type { TripResponseDto } from "../dto/trip-response.dto";
import { WaypointType } from "../entities/trip-waypoint.entity";
import { type GeoPoint, TripStatus, TripType } from "../entities/trip.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { type CreateTripWaypointInput, TripsRepository } from "../repositories/trips.repository";

interface FieldValidationError {
	field: string;
	errors: string[];
}

const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const TRIP_BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";
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
		private readonly dataSource: DataSource
	) {}

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
				cancellationPolicy: dto.cancellationPolicy ?? null,
				waypoints: dto.waypoints.map(toWaypointInput),
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

	async configureWaypoints(
		hostId: string,
		tripId: string,
		dto: ConfigureTripWaypointsDto
	): Promise<TripResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
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
				return lockedTrip.trip;
			}

			const updated = await repository.replaceWaypointsAndSubmitForApproval(
				tripId,
				dto.waypoints.map(toWaypointInput)
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

			return updated;
		});
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
				durationNights: deriveDurationNights(dto.tripType, startsAt, endsAt),
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
		trip: Pick<
			TripResponseDto,
			"startsAt" | "endsAt" | "tripType" | "durationNights" | "waypoints"
		>,
		requireApprovalReady: boolean
	): void {
		const errors: FieldValidationError[] = [];
		const startsAt = new Date(trip.startsAt);
		const endsAt = new Date(trip.endsAt);
		const sequenceOrders = new Set<number>();
		const maxDayNumber = trip.durationNights + 1;
		let startSequenceOrder: number | null = null;
		let finishSequenceOrder: number | null = null;

		for (const [index, waypoint] of waypoints.entries()) {
			if (sequenceOrders.has(waypoint.sequenceOrder)) {
				errors.push({
					field: `waypoints.${index}.sequenceOrder`,
					errors: ["sequenceOrder must be unique within the Trip"],
				});
			}
			sequenceOrders.add(waypoint.sequenceOrder);

			if (waypoint.dayNumber > maxDayNumber) {
				errors.push({
					field: `waypoints.${index}.dayNumber`,
					errors: ["dayNumber must be within the Trip duration"],
				});
			}
			if (waypoint.plannedAt) {
				const plannedAt = new Date(waypoint.plannedAt);
				if (plannedAt < startsAt || plannedAt > endsAt) {
					errors.push({
						field: `waypoints.${index}.plannedAt`,
						errors: ["plannedAt must be within the Trip schedule"],
					});
				}
			}
			if (waypoint.type === WaypointType.START) {
				startSequenceOrder = waypoint.sequenceOrder;
			}
			if (waypoint.type === WaypointType.FINISH) {
				finishSequenceOrder = waypoint.sequenceOrder;
			}
		}

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
		if (
			startSequenceOrder != null &&
			finishSequenceOrder != null &&
			startSequenceOrder >= finishSequenceOrder
		) {
			errors.push({
				field: "waypoints",
				errors: ["start waypoint must occur before finish waypoint"],
			});
		}
		if (trip.tripType === TripType.DAY_TRIP && overnightCount > 0) {
			errors.push({
				field: "waypoints",
				errors: ["day_trip cannot include overnight waypoints"],
			});
		}
		if (
			requireApprovalReady &&
			trip.tripType === TripType.OVERNIGHT &&
			overnightCount !== trip.durationNights
		) {
			errors.push({
				field: "waypoints",
				errors: ["overnight Trips must include one overnight waypoint per duration night"],
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
				dayNumber: waypoint.dayNumber,
				sequenceOrder: waypoint.sequenceOrder,
				plannedAt: waypoint.plannedAt,
				durationMinutes: waypoint.durationMinutes,
			})),
		};
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

function toWaypointInput(waypoint: CreateTripWaypointDto): CreateTripWaypointInput {
	return {
		checkpointId: waypoint.checkpointId ?? null,
		type: waypoint.type,
		name: waypoint.name,
		location: toGeoPoint(waypoint.location),
		dayNumber: waypoint.dayNumber,
		sequenceOrder: waypoint.sequenceOrder,
		plannedAt: waypoint.plannedAt ? new Date(waypoint.plannedAt) : null,
		durationMinutes: waypoint.durationMinutes ?? null,
		metadata: waypoint.metadata ?? null,
	};
}

function waypointsMatchDto(
	currentWaypoints: TripResponseDto["waypoints"],
	incomingWaypoints: CreateTripWaypointDto[]
): boolean {
	if (currentWaypoints.length !== incomingWaypoints.length) return false;

	const currentBySequence = [...currentWaypoints].sort(
		(first, second) => first.sequenceOrder - second.sequenceOrder
	);
	const incomingBySequence = [...incomingWaypoints].sort(
		(first, second) => first.sequenceOrder - second.sequenceOrder
	);

	return currentBySequence.every((current, index) => {
		const incoming = incomingBySequence[index];
		return (
			current.checkpointId === (incoming.checkpointId ?? null) &&
			current.type === incoming.type &&
			current.name === incoming.name &&
			coordinatesMatch(current.location.coordinates, incoming.location.coordinates) &&
			current.dayNumber === incoming.dayNumber &&
			current.sequenceOrder === incoming.sequenceOrder &&
			normalizeDate(current.plannedAt) === normalizeDate(incoming.plannedAt) &&
			current.durationMinutes === (incoming.durationMinutes ?? null) &&
			JSON.stringify(current.metadata ?? null) === JSON.stringify(incoming.metadata ?? null)
		);
	});
}

function coordinatesMatch(first: [number, number], second: [number, number]): boolean {
	return first[0] === second[0] && first[1] === second[1];
}

function normalizeDate(value: Date | string | undefined | null): string | null {
	if (!value) return null;
	return new Date(value).toISOString();
}
