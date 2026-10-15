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
import { PorterRequestStatus } from "../entities/porter-request.entity";
import { TripStatus } from "../entities/trip.entity";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { PorterRequestsRepository } from "../repositories/porter-requests.repository";
import type {
	PorterRequestAssignmentSummary,
	PorterRequestWithContext,
} from "../repositories/porter-requests.repository";
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
			if (trip.status !== TripStatus.PUBLISHED) {
				throw new ConflictException("Only upcoming published Trips can request Porters");
			}
			if (await porterRequests.hasActiveAssignmentForTrip(tripId)) {
				throw new ConflictException("Trip already has an assigned Porter");
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

	async findPending(
		hostId: string,
		tripId: string,
		porterId: string
	): Promise<PorterRequestResponseDto | null> {
		const trip = await this.tripsRepository.findPorterAvailabilityContext(tripId);
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}
		if (trip.hostId !== hostId) {
			throw new ForbiddenException("Only the owning Host can view Porter Requests for this Trip");
		}

		const request = await this.porterRequestsRepository.findPendingByTripAndPorter(
			tripId,
			porterId
		);
		return request ? toPorterRequestResponse(request) : null;
	}

	async listForPorter(porterId: string): Promise<PorterRequestResponseDto[]> {
		const expired = await this.expirePendingForPorter(porterId);
		for (const request of expired) this.emitStateChangedNotification(request);
		const requests = await this.porterRequestsRepository.listForPorter(porterId);
		return requests.map(toPorterRequestResponse);
	}

	async listForHostTrip(hostId: string, tripId: string): Promise<PorterRequestResponseDto[]> {
		const trip = await this.tripsRepository.findPorterAvailabilityContext(tripId);
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}
		if (trip.hostId !== hostId) {
			throw new ForbiddenException("Only the owning Host can view Porter Requests for this Trip");
		}
		const requests = await this.porterRequestsRepository.listByTripForHost(tripId);
		return requests.map(toPorterRequestResponse);
	}

	async listForHost(hostId: string): Promise<PorterRequestResponseDto[]> {
		const expired = await this.porterRequestsRepository.expirePendingByHost(hostId);
		for (const request of expired) this.emitStateChangedNotification(request);
		const requests = await this.porterRequestsRepository.listRespondedForHost(hostId);
		return requests.map(toPorterRequestResponse);
	}

	async accept(porterId: string, requestId: string): Promise<PorterRequestResponseDto> {
		const result = await this.dataSource.transaction(async (manager: EntityManager) => {
			const now = await this.captureDatabaseTime(manager);
			const porterRequests = manager.withRepository(this.porterRequestsRepository);
			const request = await porterRequests.findByIdForUpdate(requestId);
			if (!request) throw new NotFoundException("Porter Request not found");
			if (request.porterId !== porterId) {
				throw new ForbiddenException("Only the requested Porter can accept this Request");
			}

			if (request.status === PorterRequestStatus.ACCEPTED) {
				const existing = await porterRequests.findByIdWithContext(requestId);
				if (existing?.assignment) return { request: existing, changed: false };
				throw new ConflictException("Accepted Porter Request is missing its Assignment");
			}
			if (request.status !== PorterRequestStatus.PENDING) {
				throw new ConflictException("Porter Request is no longer pending");
			}
			if (request.expiresAt.getTime() <= now.getTime()) {
				const expired = await porterRequests.markStatus(
					request.id,
					PorterRequestStatus.EXPIRED,
					now
				);
				return { request: expired, changed: true };
			}

			const trip = await this.findTripForAssignment(manager, request.tripId);
			if (trip.status !== TripStatus.PUBLISHED) {
				throw new ConflictException("Trip state does not allow Porter assignment");
			}
			if (await porterRequests.hasActiveAssignmentForTrip(request.tripId)) {
				throw new ConflictException("Trip already has an assigned Porter");
			}

			await this.assertPorterEligible(manager, {
				tripId: request.tripId,
				porterId: request.porterId,
				routeId: trip.routeId,
				role: request.requestedRole,
				startsAt: trip.startsAt,
				endsAt: trip.endsAt,
			});

			const assignment = await porterRequests.createAssignedTripPorterIdempotent(
				request.tripId,
				request.porterId
			);
			const accepted = await porterRequests.markStatus(
				request.id,
				PorterRequestStatus.ACCEPTED,
				now
			);
			return {
				request: {
					...accepted,
					trip: {
						id: trip.id,
						title: trip.title,
						status: trip.status,
						startsAt: trip.startsAt,
						endsAt: trip.endsAt,
						meetingAt: trip.meetingAt,
					},
					assignment,
				},
				changed: true,
			};
		});

		if (result.changed) this.emitStateChangedNotification(result.request);
		return toPorterRequestResponse(result.request);
	}

	async decline(porterId: string, requestId: string): Promise<PorterRequestResponseDto> {
		const result = await this.respondTerminal({
			requestId,
			status: PorterRequestStatus.DECLINED,
			authorize: (request) => request.porterId === porterId,
			forbiddenMessage: "Only the requested Porter can decline this Request",
		});
		if (result.changed) this.emitStateChangedNotification(result.request);
		return toPorterRequestResponse(result.request);
	}

	async cancel(
		hostId: string,
		tripId: string,
		requestId: string
	): Promise<PorterRequestResponseDto> {
		const result = await this.respondTerminal({
			requestId,
			status: PorterRequestStatus.CANCELLED,
			authorize: (request) => request.requestedBy === hostId && request.tripId === tripId,
			forbiddenMessage: "Only the owning Host can cancel this Porter Request",
		});
		if (result.changed) this.emitStateChangedNotification(result.request);
		return toPorterRequestResponse(result.request);
	}

	async expirePending(limit = 100): Promise<number> {
		const rows = (await this.dataSource.query(
			`
			UPDATE "porter_requests"
			SET "status" = $1,
				"responded_at" = clock_timestamp(),
				"updated_at" = clock_timestamp()
			WHERE "id" IN (
				SELECT "id"
				FROM "porter_requests"
				WHERE "status" = $2
					AND "expires_at" <= clock_timestamp()
				ORDER BY "expires_at" ASC, "id" ASC
				LIMIT $3
			)
			RETURNING
				"id",
				"trip_id" AS "tripId",
				"porter_id" AS "porterId",
				"requested_by" AS "requestedBy",
				"requested_role" AS "requestedRole",
				"note",
				"status",
				"expires_at" AS "expiresAt",
				"responded_at" AS "respondedAt",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			`,
			[PorterRequestStatus.EXPIRED, PorterRequestStatus.PENDING, limit]
		)) as PorterRequest[];
		for (const request of rows) this.emitStateChangedNotification(request);
		return rows.length;
	}

	private async respondTerminal(input: {
		requestId: string;
		status:
			| PorterRequestStatus.DECLINED
			| PorterRequestStatus.CANCELLED
			| PorterRequestStatus.EXPIRED;
		authorize: (request: PorterRequest) => boolean;
		forbiddenMessage: string;
	}): Promise<{ request: PorterRequestWithContext; changed: boolean }> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const now = await this.captureDatabaseTime(manager);
			const porterRequests = manager.withRepository(this.porterRequestsRepository);
			const request = await porterRequests.findByIdForUpdate(input.requestId);
			if (!request) throw new NotFoundException("Porter Request not found");
			if (!input.authorize(request)) throw new ForbiddenException(input.forbiddenMessage);

			if (request.status === input.status) {
				const existing = await porterRequests.findByIdWithContext(input.requestId);
				if (!existing) throw new NotFoundException("Porter Request not found");
				return { request: existing, changed: false };
			}
			if (request.status !== PorterRequestStatus.PENDING) {
				throw new ConflictException("Porter Request is already terminal");
			}
			if (
				input.status !== PorterRequestStatus.EXPIRED &&
				request.expiresAt.getTime() <= now.getTime()
			) {
				const expired = await porterRequests.markStatus(
					request.id,
					PorterRequestStatus.EXPIRED,
					now
				);
				return { request: expired, changed: true };
			}
			const updated = await porterRequests.markStatus(request.id, input.status, now);
			return { request: updated, changed: true };
		});
	}

	private async findTripForAssignment(
		manager: EntityManager,
		tripId: string
	): Promise<{
		id: string;
		title: string;
		status: TripStatus;
		routeId: string;
		startsAt: Date;
		endsAt: Date;
		meetingAt: Date | null;
	}> {
		const rows = (await manager.query(
			`
			SELECT
				"id",
				"title",
				"status",
				"route_id" AS "routeId",
				"starts_at" AS "startsAt",
				"ends_at" AS "endsAt",
				"meeting_at" AS "meetingAt"
			FROM "trips"
			WHERE "id" = $1
			FOR UPDATE
			`,
			[tripId]
		)) as Array<{
			id: string;
			title: string;
			status: TripStatus;
			routeId: string | null;
			startsAt: Date | null;
			endsAt: Date | null;
			meetingAt: Date | null;
		}>;
		const trip = rows[0];
		if (!trip) throw new NotFoundException("Trip not found");
		if (!trip.routeId || !trip.startsAt || !trip.endsAt || trip.startsAt >= trip.endsAt) {
			throw new ConflictException("Trip Route and schedule must be valid before assignment");
		}
		return {
			id: trip.id,
			title: trip.title,
			status: trip.status,
			routeId: trip.routeId,
			startsAt: trip.startsAt,
			endsAt: trip.endsAt,
			meetingAt: trip.meetingAt,
		};
	}

	private async expirePendingForPorter(porterId: string): Promise<PorterRequest[]> {
		return this.dataSource.query(
			`
			UPDATE "porter_requests"
			SET "status" = $1,
				"responded_at" = clock_timestamp(),
				"updated_at" = clock_timestamp()
			WHERE "porter_id" = $2
				AND "status" = $3
				AND "expires_at" <= clock_timestamp()
			RETURNING
				"id",
				"trip_id" AS "tripId",
				"porter_id" AS "porterId",
				"requested_by" AS "requestedBy",
				"requested_role" AS "requestedRole",
				"note",
				"status",
				"expires_at" AS "expiresAt",
				"responded_at" AS "respondedAt",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			`,
			[PorterRequestStatus.EXPIRED, porterId, PorterRequestStatus.PENDING]
		);
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

	private emitStateChangedNotification(
		request: Pick<
			PorterRequest,
			"id" | "tripId" | "porterId" | "requestedBy" | "status" | "respondedAt"
		>
	): void {
		try {
			this.eventsGateway.emitPorterRequestStateChanged({
				requestId: request.id,
				tripId: request.tripId,
				porterId: request.porterId,
				requestedBy: request.requestedBy,
				status: request.status,
				respondedAt: request.respondedAt?.toISOString() ?? null,
			});
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown notification error";
			this.logger.warn(`Porter Request state notification failed after commit: ${message}`);
		}
	}
}

function toPorterRequestResponse(
	request: PorterRequest | PorterRequestWithContext
): PorterRequestResponseDto {
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
		trip: "trip" in request ? (request.trip ?? null) : undefined,
		assignment:
			"assignment" in request ? normalizeAssignment(request.assignment ?? null) : undefined,
	};
}

function normalizeAssignment(
	assignment: PorterRequestAssignmentSummary | null
): PorterRequestAssignmentSummary | null {
	return assignment;
}
