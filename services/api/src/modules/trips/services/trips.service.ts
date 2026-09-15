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

@Injectable()
export class TripsService {
	constructor(
		private readonly tripsRepository: TripsRepository,
		private readonly dataSource: DataSource
	) {}

	async create(hostId: string, dto: CreateTripDto): Promise<TripResponseDto> {
		this.assertCreateTripPayload(dto);

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
				durationNights: dto.durationNights,
				startsAt: new Date(dto.startsAt),
				endsAt: new Date(dto.endsAt),
				meetingPoint: toGeoPoint(dto.meetingPoint),
				meetingAt: dto.meetingAt ? new Date(dto.meetingAt) : null,
				bookingDeadline: new Date(dto.bookingDeadline),
				capacityMin: dto.capacityMin,
				capacityMax: dto.capacityMax,
				isFree: dto.isFree,
				pricePerPerson: dto.pricePerPerson,
				provinceCode: dto.provinceCode,
				cityCode: dto.cityCode,
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

	private assertCreateTripPayload(dto: CreateTripDto): void {
		const errors: FieldValidationError[] = [];
		const startsAt = new Date(dto.startsAt);
		const endsAt = new Date(dto.endsAt);
		const bookingDeadline = new Date(dto.bookingDeadline);
		const meetingAt = dto.meetingAt ? new Date(dto.meetingAt) : null;

		if (startsAt >= endsAt) {
			errors.push({ field: "endsAt", errors: ["endsAt must be after startsAt"] });
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
		if (dto.capacityMin > dto.capacityMax) {
			errors.push({
				field: "capacityMin",
				errors: ["capacityMin must be less than or equal to capacityMax"],
			});
		}
		if (dto.isFree && dto.pricePerPerson !== 0) {
			errors.push({ field: "pricePerPerson", errors: ["pricePerPerson must be 0 for free Trips"] });
		}
		if (!dto.isFree && dto.pricePerPerson <= 0) {
			errors.push({
				field: "pricePerPerson",
				errors: ["pricePerPerson must be greater than 0 for paid Trips"],
			});
		}
		if (dto.tripType === TripType.DAY_TRIP && dto.durationNights !== 0) {
			errors.push({ field: "durationNights", errors: ["day trips must have 0 durationNights"] });
		}
		if (dto.tripType === TripType.OVERNIGHT && dto.durationNights < 1) {
			errors.push({
				field: "durationNights",
				errors: ["overnight trips must have at least 1 durationNight"],
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
			isFree: trip.isFree,
			pricePerPerson: trip.pricePerPerson,
			provinceCode: trip.provinceCode,
			cityCode: trip.cityCode,
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
