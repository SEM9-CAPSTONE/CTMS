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
import type { CreateTripDto, CreateTripWaypointDto, GeoJsonPointDto } from "../dto/create-trip.dto";
import type { TripResponseDto } from "../dto/trip-response.dto";
import { WaypointType } from "../entities/trip-waypoint.entity";
import { type GeoPoint, TripType } from "../entities/trip.entity";
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

		const sequenceOrders = new Set<number>();
		for (const [index, waypoint] of dto.waypoints.entries()) {
			if (sequenceOrders.has(waypoint.sequenceOrder)) {
				errors.push({
					field: `waypoints.${index}.sequenceOrder`,
					errors: ["sequenceOrder must be unique within the Trip"],
				});
			}
			sequenceOrders.add(waypoint.sequenceOrder);

			if (waypoint.plannedAt) {
				const plannedAt = new Date(waypoint.plannedAt);
				if (plannedAt < startsAt || plannedAt > endsAt) {
					errors.push({
						field: `waypoints.${index}.plannedAt`,
						errors: ["plannedAt must be within the Trip schedule"],
					});
				}
			}
		}

		if (!dto.waypoints.some((waypoint) => waypoint.type === WaypointType.START)) {
			errors.push({ field: "waypoints", errors: ["Trip must include a start waypoint"] });
		}
		if (!dto.waypoints.some((waypoint) => waypoint.type === WaypointType.FINISH)) {
			errors.push({ field: "waypoints", errors: ["Trip must include a finish waypoint"] });
		}

		if (errors.length > 0) {
			throw this.validationException(errors);
		}

		return { startsAt, endsAt, bookingDeadline, meetingAt };
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
