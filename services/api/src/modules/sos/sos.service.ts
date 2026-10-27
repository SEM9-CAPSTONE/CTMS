import {
	ConflictException,
	ForbiddenException,
	HttpStatus,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { DataSource } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { EventsGateway } from "../realtime/events.gateway";
import type { CancelSosDto } from "./dto/cancel-sos.dto";
import type { CreateSosDto } from "./dto/create-sos.dto";
import { type SosAlertResponseDto, toSosAlertResponseDto } from "./dto/sos-alert-response.dto";
import { SosAlert } from "./entities/sos-alert.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { SosAlertsRepository } from "./sos-alerts.repository";
import { SosErrorCode, SosStatus } from "./sos.enums";

@Injectable()
export class SosService {
	constructor(
		private readonly sosRepository: SosAlertsRepository,
		private readonly participation: GpsParticipationSource,
		private readonly eventsGateway: EventsGateway,
		private readonly dataSource: DataSource
	) {}

	/**
	 * CTMS-074: Create an emergency SOS alert for an active Trip.
	 */
	async createSos(userId: string, tripId: string, dto: CreateSosDto): Promise<SosAlertResponseDto> {
		await this.assertTripParticipant(userId, tripId);

		const now = new Date();
		const alert = this.sosRepository.create({
			tripId,
			senderId: userId,
			emergencyType: dto.emergencyType,
			location: dto.location
				? {
						type: "Point",
						coordinates: [dto.location.longitude, dto.location.latitude],
					}
				: null,
			batteryLevel: dto.batteryLevel ?? null,
			eventTime: new Date(dto.eventTime),
			status: SosStatus.ACTIVE,
			receivedAt: now,
			createdAt: now,
			updatedAt: now,
		});

		const saved = await this.sosRepository.save(alert);

		// Record audit log for SOS creation
		await this.dataSource.getRepository(AuditLog).save({
			actorId: userId,
			action: "SOS_CREATED",
			targetType: "sos_alert",
			targetId: saved.id,
			before: null,
			after: {
				id: saved.id,
				tripId: saved.tripId,
				emergencyType: saved.emergencyType,
				status: saved.status,
			},
			reason: null,
		});

		// Broadcast real-time event to Host and trip participants
		this.eventsGateway.emitSosCreated({
			sosId: saved.id,
			tripId: saved.tripId,
			senderId: saved.senderId,
			emergencyType: saved.emergencyType,
			eventTime: saved.eventTime.toISOString(),
		});

		return toSosAlertResponseDto(saved);
	}

	/**
	 * CTMS-077: Cancel an accidentally created SOS alert.
	 * Follows BR-258: Only the sender can cancel, only while status is ACTIVE,
	 * captures cancelled_by, cancelled_at, reason, and preserves history via AuditLog (BR-191).
	 */
	async cancel(
		userId: string,
		tripId: string,
		sosId: string,
		dto: CancelSosDto
	): Promise<SosAlertResponseDto> {
		await this.assertTripParticipant(userId, tripId);

		let updatedAlert: SosAlert | null = null;

		await this.dataSource.transaction(async (manager) => {
			const alert = await this.sosRepository.findForUpdate(sosId, manager);
			if (!alert || alert.tripId !== tripId) {
				throw new NotFoundException({
					statusCode: HttpStatus.NOT_FOUND,
					error: SosErrorCode.SOS_NOT_FOUND,
					message: "SOS alert not found for this trip",
				});
			}

			// Validate sender ownership: only the user who triggered the SOS can cancel it
			if (alert.senderId !== userId) {
				throw new ForbiddenException({
					statusCode: HttpStatus.FORBIDDEN,
					error: SosErrorCode.NOT_SOS_SENDER,
					message: "Only the sender can cancel this accidental SOS alert",
				});
			}

			// Validate current status
			if (alert.status !== SosStatus.ACTIVE) {
				if (alert.status === SosStatus.CANCELLED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_CANCELLED,
						message: "SOS alert is already cancelled",
					});
				}
				if (alert.status === SosStatus.ACKNOWLEDGED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_ACKNOWLEDGED,
						message: "Cannot cancel SOS: rescue handling has already been acknowledged by the Host",
					});
				}
				if (alert.status === SosStatus.CLOSED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_CLOSED,
						message: "Cannot cancel SOS: alert has already been closed",
					});
				}
				throw new ConflictException({
					statusCode: HttpStatus.CONFLICT,
					error: SosErrorCode.SOS_NOT_ACTIVE,
					message: `SOS alert cannot be cancelled in state: ${alert.status}`,
				});
			}

			const beforeSnapshot = {
				id: alert.id,
				status: alert.status,
				cancelledBy: alert.cancelledBy,
				cancelledAt: alert.cancelledAt,
				cancellationReason: alert.cancellationReason,
			};

			const now = new Date();
			alert.status = SosStatus.CANCELLED;
			alert.cancelledBy = userId;
			alert.cancelledAt = now;
			alert.cancellationReason = dto.reason;

			updatedAlert = await manager.getRepository(SosAlert).save(alert);

			// BR-191: Critical action audit logging
			await manager.getRepository(AuditLog).save({
				actorId: userId,
				action: "SOS_CANCELLED",
				targetType: "sos_alert",
				targetId: alert.id,
				before: beforeSnapshot,
				after: {
					id: alert.id,
					status: alert.status,
					cancelledBy: alert.cancelledBy,
					cancelledAt: alert.cancelledAt,
					cancellationReason: alert.cancellationReason,
				},
				reason: dto.reason,
			});
		});

		if (updatedAlert) {
			const alert = updatedAlert as SosAlert;
			this.eventsGateway.emitSosStateChanged({
				sosId: alert.id,
				tripId: alert.tripId,
				senderId: alert.senderId,
				status: alert.status,
				cancelledBy: alert.cancelledBy,
				cancelledAt: alert.cancelledAt ? alert.cancelledAt.toISOString() : null,
				cancellationReason: alert.cancellationReason,
			});
		}

		return toSosAlertResponseDto(updatedAlert as unknown as SosAlert);
	}

	/**
	 * List all SOS alerts for a given trip.
	 */
	async listForTrip(userId: string, tripId: string): Promise<SosAlertResponseDto[]> {
		await this.assertTripParticipant(userId, tripId);
		const alerts = await this.sosRepository.findByTripId(tripId);
		return alerts.map(toSosAlertResponseDto);
	}

	/**
	 * Helper to verify caller is an active participant (Camper, Porter, or Host) of the Trip.
	 */
	private async assertTripParticipant(userId: string, tripId: string): Promise<void> {
		const trip = await this.participation.findTrip(tripId);
		if (!trip) {
			throw new NotFoundException({
				statusCode: HttpStatus.NOT_FOUND,
				error: SosErrorCode.TRIP_NOT_FOUND,
				message: "Trip not found",
			});
		}

		const [camper, porter] = await Promise.all([
			this.participation.findCamperParticipation(tripId, userId),
			this.participation.findPorterAssignment(tripId, userId),
		]);

		const isParticipant = camper !== null || porter !== null || trip.hostId === userId;
		if (!isParticipant) {
			throw new ForbiddenException({
				statusCode: HttpStatus.FORBIDDEN,
				error: SosErrorCode.NOT_TRIP_PARTICIPANT,
				message: "You are not a participant of this Trip",
			});
		}
	}
}
