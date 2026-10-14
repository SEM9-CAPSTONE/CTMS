import {
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { ConfigService } from "@nestjs/config";

// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { DataSource, type EntityManager } from "typeorm";
import { PorterAvailabilityStatus } from "../../profiles/entities/porter-profile.entity";
import { PorterRouteProficiency } from "../../profiles/entities/porter-route-qualification.entity";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { EventsGateway } from "../../realtime/events.gateway";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import { IntendedPorterRole } from "../dto/available-porters-query.dto";
import type { CreatePorterRequestDto } from "../dto/create-porter-request.dto";
import type { PorterRequestResponseDto } from "../dto/porter-request-response.dto";
import type { PorterRequest } from "../entities/porter-request.entity";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { PorterRequestsRepository } from "../repositories/porter-requests.repository";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { TripsRepository } from "../repositories/trips.repository";

const DEFAULT_PORTER_REQUEST_TTL_HOURS = 48;

@Injectable()
export class PorterRequestsService {
	private readonly logger = new Logger(PorterRequestsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly tripsRepository: TripsRepository,
		private readonly porterRequestsRepository: PorterRequestsRepository,
		private readonly configService: ConfigService,
		private readonly eventsGateway: EventsGateway
	) {}

	async create(
		hostId: string,
		tripId: string,
		dto: CreatePorterRequestDto
	): Promise<PorterRequestResponseDto> {
		const result = await this.dataSource.transaction(async (manager: EntityManager) => {
			const now = await this.captureDatabaseTime(manager);
			const trips = manager.withRepository(this.tripsRepository);
			const porterRequests = manager.withRepository(this.porterRequestsRepository);

			const trip = await trips.findPorterAvailabilityContext(tripId);
			if (!trip) {
				throw new NotFoundException("Trip not found");
			}
			if (trip.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can request Porters for this Trip");
			}
			if (!trip.routeId || !trip.startsAt || !trip.endsAt || trip.startsAt >= trip.endsAt) {
				throw new ConflictException(
					"Trip Route and schedule must be valid before requesting Porters"
				);
			}
			if (trip.startsAt.getTime() <= now.getTime()) {
				throw new ConflictException("Porter Requests cannot be created after the Trip starts");
			}

			await this.assertPorterEligible(manager, {
				tripId,
				porterId: dto.porterId,
				routeId: trip.routeId,
				role: dto.requestedRole,
				startsAt: trip.startsAt,
				endsAt: trip.endsAt,
			});

			return porterRequests.createPendingIdempotent({
				tripId,
				porterId: dto.porterId,
				requestedBy: hostId,
				requestedRole: dto.requestedRole,
				note: dto.note ?? null,
				expiresAt: this.calculateExpiresAt(now, trip.startsAt),
			});
		});

		if (result.created) {
			this.emitCreatedNotification(result.request);
		}

		return toPorterRequestResponse(result.request);
	}

	private async assertPorterEligible(
		manager: EntityManager,
		input: {
			tripId: string;
			porterId: string;
			routeId: string;
			role: IntendedPorterRole;
			startsAt: Date;
			endsAt: Date;
		}
	): Promise<void> {
		const conflictRows = (await manager.query(
			`SELECT 1
			 FROM "trip_porters" assignment
			 INNER JOIN "trips" assigned_trip ON assigned_trip."id" = assignment."trip_id"
			 WHERE assignment."porter_id" = $1
			   AND assignment."status" IN ('assigned', 'pending_reconfirmation')
			   AND assigned_trip."starts_at" < $2
			   AND assigned_trip."ends_at" > $3
			 LIMIT 1`,
			[input.porterId, input.endsAt, input.startsAt]
		)) as Array<{ "?column?": number }>;
		if (conflictRows.length > 0) {
			throw new ConflictException("Porter is not eligible for this Trip schedule");
		}

		const parameters: unknown[] = [
			input.porterId,
			UserStatus.ACTIVE,
			UserRole.PORTER,
			PorterAvailabilityStatus.AVAILABLE,
			input.routeId,
		];
		const conditions = [
			`candidate."id" = $1`,
			`candidate."status" = $2`,
			`(
				EXISTS (
					SELECT 1 FROM "user_roles" granted_role
					WHERE granted_role."user_id" = candidate."id" AND granted_role."role" = $3
				)
				OR (
					NOT EXISTS (
						SELECT 1 FROM "user_roles" any_role
						WHERE any_role."user_id" = candidate."id"
					)
					AND candidate."role" = $3
				)
			)`,
			`profile."availability_status" = $4`,
		];

		if (input.role === IntendedPorterRole.LEAD) {
			parameters.push([PorterRouteProficiency.PROFICIENT, PorterRouteProficiency.EXPERT]);
			conditions.push(
				`qualification."proficiency" = ANY($${parameters.length}::porter_route_proficiency[])`,
				`qualification."verified_by" IS NOT NULL`,
				`qualification."verified_at" IS NOT NULL`
			);
		}

		const rows = (await manager.query(
			`SELECT 1
			 FROM "porter_profiles" profile
			 INNER JOIN "users" candidate ON candidate."id" = profile."porter_id"
			 LEFT JOIN "porter_route_qualifications" qualification
				ON qualification."porter_id" = profile."porter_id"
				AND qualification."route_id" = $5
			 WHERE ${conditions.join(" AND ")}
			 LIMIT 1`,
			parameters
		)) as Array<{ "?column?": number }>;

		if (rows.length === 0) {
			throw new ConflictException("Porter is not eligible for this Trip");
		}
	}

	private calculateExpiresAt(now: Date, tripStartsAt: Date): Date {
		const configuredHours = Number(this.configService.get<string>("PORTER_REQUEST_TTL_HOURS"));
		const ttlHours =
			Number.isFinite(configuredHours) && configuredHours > 0
				? configuredHours
				: DEFAULT_PORTER_REQUEST_TTL_HOURS;
		const policyExpiry = new Date(now.getTime() + ttlHours * 60 * 60_000);
		return policyExpiry.getTime() < tripStartsAt.getTime() ? policyExpiry : tripStartsAt;
	}

	private async captureDatabaseTime(manager: EntityManager): Promise<Date> {
		const rows = (await manager.query(`SELECT clock_timestamp() AS "now"`)) as Array<{
			now: Date;
		}>;
		const now = rows[0]?.now;
		if (!(now instanceof Date)) {
			throw new Error("Database did not return request creation time");
		}
		return now;
	}

	private emitCreatedNotification(request: PorterRequest): void {
		try {
			this.eventsGateway.emitPorterRequestCreated({
				requestId: request.id,
				tripId: request.tripId,
				porterId: request.porterId,
				requestedBy: request.requestedBy,
				requestedRole: request.requestedRole,
				expiresAt: request.expiresAt.toISOString(),
			});
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown notification error";
			this.logger.warn(`Porter Request notification failed after commit: ${message}`);
		}
	}
}

function toPorterRequestResponse(request: PorterRequest): PorterRequestResponseDto {
	return {
		id: request.id,
		tripId: request.tripId,
		porterId: request.porterId,
		requestedBy: request.requestedBy,
		requestedRole: request.requestedRole,
		note: request.note,
		status: request.status,
		expiresAt: request.expiresAt,
		respondedAt: request.respondedAt,
		createdAt: request.createdAt,
		updatedAt: request.updatedAt,
	};
}
