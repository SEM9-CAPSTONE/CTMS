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
import { GpsParticipationSource, type TrackedTrip } from "../gps-tracking/gps-participation.source";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { EventsGateway } from "../realtime/events.gateway";
import type { CancelSosDto } from "./dto/cancel-sos.dto";
import type { CloseSosDto } from "./dto/close-sos.dto";
import type { CreateSosDto } from "./dto/create-sos.dto";
import type { GetHostSosQueryDto } from "./dto/get-host-sos-query.dto";
import type { HostSosListResponseDto } from "./dto/host-sos-list-response.dto";
import { type SosAlertResponseDto, toSosAlertResponseDto } from "./dto/sos-alert-response.dto";
import { SosAlert } from "./entities/sos-alert.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { SosAlertsRepository } from "./sos-alerts.repository";
import { SosErrorCode, SosStatus } from "./sos.enums";

type SosTrip = TrackedTrip & { hostId: string };

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
		const trip = await this.assertTripParticipant(userId, tripId);

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

		// CTMS-079, BR-260: only after persistence, and only to the Host authorized for this Trip
		this.eventsGateway.emitSosCreated(trip.hostId, {
			eventId: saved.id,
			sosId: saved.id,
			tripId: saved.tripId,
			senderId: saved.senderId,
			emergencyType: saved.emergencyType,
			status: saved.status,
			eventTime: saved.eventTime.toISOString(),
			persistedAt: saved.receivedAt.toISOString(),
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
		const trip = await this.assertTripParticipant(userId, tripId);

		let updatedAlert: SosAlert | null = null;

		await this.dataSource.transaction(async (manager) => {
			const alert = await this.sosRepository.findForUpdate(sosId, manager);
			if (!alert || alert.tripId !== tripId) {
				throw new NotFoundException({
					statusCode: HttpStatus.NOT_FOUND,
					error: SosErrorCode.SOS_NOT_FOUND,
					message: "Không tìm thấy yêu cầu cứu trợ cho chuyến đi này",
				});
			}

			// Validate sender ownership: only the user who triggered the SOS can cancel it
			if (alert.senderId !== userId) {
				throw new ForbiddenException({
					statusCode: HttpStatus.FORBIDDEN,
					error: SosErrorCode.NOT_SOS_SENDER,
					message: "Chỉ người gửi mới có quyền hủy yêu cầu cứu trợ này",
				});
			}

			// Validate current status
			if (alert.status !== SosStatus.ACTIVE) {
				if (alert.status === SosStatus.CANCELLED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_CANCELLED,
						message: "Yêu cầu cứu trợ này đã được hủy trước đó",
					});
				}
				if (alert.status === SosStatus.ACKNOWLEDGED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_ACKNOWLEDGED,
						message: "Không thể hủy: Yêu cầu cứu trợ đã được Host tiếp nhận xử lý",
					});
				}
				if (alert.status === SosStatus.CLOSED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_CLOSED,
						message: "Không thể hủy: Yêu cầu cứu trợ đã được đóng hoàn tất",
					});
				}
				throw new ConflictException({
					statusCode: HttpStatus.CONFLICT,
					error: SosErrorCode.SOS_NOT_ACTIVE,
					message: `Không thể hủy yêu cầu cứu trợ ở trạng thái: ${alert.status}`,
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
			this.eventsGateway.emitSosStateChanged(trip.hostId, {
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
	 * CTMS-080, BR-261: Acknowledge an SOS alert.
	 * Only an authorized Host managing the Trip may acknowledge.
	 * Transitions SOS from ACTIVE -> ACKNOWLEDGED, records acknowledged_by and acknowledged_at.
	 * Preserves audit history (BR-191) and notifies sender and participants after commit (PB AC-4, PB AC-8).
	 */
	async acknowledge(userId: string, tripId: string, sosId: string): Promise<SosAlertResponseDto> {
		const trip = await this.assertTripHost(userId, tripId);

		let updatedAlert: SosAlert | null = null;

		await this.dataSource.transaction(async (manager) => {
			const alert = await this.sosRepository.findForUpdate(sosId, manager);
			if (!alert || alert.tripId !== tripId) {
				throw new NotFoundException({
					statusCode: HttpStatus.NOT_FOUND,
					error: SosErrorCode.SOS_NOT_FOUND,
					message: "Không tìm thấy yêu cầu cứu trợ cho chuyến đi này",
				});
			}

			if (alert.status !== SosStatus.ACTIVE) {
				if (alert.status === SosStatus.CANCELLED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_CANCELLED,
						message: "Không thể tiếp nhận: Yêu cầu cứu trợ đã bị người gửi hủy bỏ",
					});
				}
				if (alert.status === SosStatus.ACKNOWLEDGED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_ACKNOWLEDGED,
						message: "Yêu cầu cứu trợ này đã được tiếp nhận xử lý trước đó",
					});
				}
				if (alert.status === SosStatus.CLOSED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_CLOSED,
						message: "Không thể tiếp nhận: Yêu cầu cứu trợ đã được đóng hoàn tất",
					});
				}
				throw new ConflictException({
					statusCode: HttpStatus.CONFLICT,
					error: SosErrorCode.SOS_NOT_ACTIVE,
					message: `Không thể tiếp nhận yêu cầu cứu trợ ở trạng thái: ${alert.status}`,
				});
			}

			const beforeSnapshot = {
				id: alert.id,
				status: alert.status,
				acknowledgedBy: alert.acknowledgedBy,
				acknowledgedAt: alert.acknowledgedAt,
			};

			const now = new Date();
			alert.status = SosStatus.ACKNOWLEDGED;
			alert.acknowledgedBy = userId;
			alert.acknowledgedAt = now;

			updatedAlert = await manager.getRepository(SosAlert).save(alert);

			// BR-191: Critical action audit logging
			await manager.getRepository(AuditLog).save({
				actorId: userId,
				action: "SOS_ACKNOWLEDGED",
				targetType: "sos_alert",
				targetId: alert.id,
				before: beforeSnapshot,
				after: {
					id: alert.id,
					status: alert.status,
					acknowledgedBy: alert.acknowledgedBy,
					acknowledgedAt: alert.acknowledgedAt,
				},
				reason: null,
			});
		});

		if (updatedAlert) {
			const alert = updatedAlert as SosAlert;
			// AC3 / AC6: Broadcast real-time event to sender and team only after commit
			this.eventsGateway.emitSosStateChanged(trip.hostId, {
				sosId: alert.id,
				tripId: alert.tripId,
				senderId: alert.senderId,
				status: alert.status,
				acknowledgedBy: alert.acknowledgedBy,
				acknowledgedAt: alert.acknowledgedAt ? alert.acknowledgedAt.toISOString() : null,
			});
		}

		return toSosAlertResponseDto(updatedAlert as unknown as SosAlert);
	}

	/**
	 * CTMS-080, BR-261: Close an acknowledged SOS alert with resolution note.
	 * Only an authorized Host managing the Trip may close.
	 * Closing is allowed ONLY from ACKNOWLEDGED state.
	 * CLOSED is a terminal state in MVP and cannot be reopened (PB AC-7).
	 * Records closed_by, closed_at, and resolution_note.
	 * Preserves audit history (BR-191) and notifies sender/team after commit (PB AC-8).
	 */
	async close(
		userId: string,
		tripId: string,
		sosId: string,
		dto: CloseSosDto
	): Promise<SosAlertResponseDto> {
		const trip = await this.assertTripHost(userId, tripId);

		let updatedAlert: SosAlert | null = null;

		await this.dataSource.transaction(async (manager) => {
			const alert = await this.sosRepository.findForUpdate(sosId, manager);
			if (!alert || alert.tripId !== tripId) {
				throw new NotFoundException({
					statusCode: HttpStatus.NOT_FOUND,
					error: SosErrorCode.SOS_NOT_FOUND,
					message: "Không tìm thấy yêu cầu cứu trợ cho chuyến đi này",
				});
			}

			if (alert.status !== SosStatus.ACKNOWLEDGED) {
				if (alert.status === SosStatus.CLOSED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_CLOSED,
						message: "Yêu cầu cứu trợ này đã được đóng hoàn tất và không thể mở lại",
					});
				}
				if (alert.status === SosStatus.CANCELLED) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_ALREADY_CANCELLED,
						message: "Không thể đóng: Yêu cầu cứu trợ đã bị người gửi hủy bỏ",
					});
				}
				if (alert.status === SosStatus.ACTIVE) {
					throw new ConflictException({
						statusCode: HttpStatus.CONFLICT,
						error: SosErrorCode.SOS_NOT_ACKNOWLEDGED,
						message: "Yêu cầu cứu trợ phải được tiếp nhận trước khi đóng",
					});
				}
				throw new ConflictException({
					statusCode: HttpStatus.CONFLICT,
					error: SosErrorCode.SOS_NOT_ACKNOWLEDGED,
					message: `Không thể đóng yêu cầu cứu trợ ở trạng thái: ${alert.status}`,
				});
			}

			const beforeSnapshot = {
				id: alert.id,
				status: alert.status,
				closedBy: alert.closedBy,
				closedAt: alert.closedAt,
				resolutionNote: alert.resolutionNote,
			};

			const now = new Date();
			alert.status = SosStatus.CLOSED;
			alert.closedBy = userId;
			alert.closedAt = now;
			alert.resolutionNote = dto.resolutionNote;

			updatedAlert = await manager.getRepository(SosAlert).save(alert);

			// BR-191: Critical action audit logging
			await manager.getRepository(AuditLog).save({
				actorId: userId,
				action: "SOS_CLOSED",
				targetType: "sos_alert",
				targetId: alert.id,
				before: beforeSnapshot,
				after: {
					id: alert.id,
					status: alert.status,
					closedBy: alert.closedBy,
					closedAt: alert.closedAt,
					resolutionNote: alert.resolutionNote,
				},
				reason: dto.resolutionNote,
			});
		});

		if (updatedAlert) {
			const alert = updatedAlert as SosAlert;
			// AC6: Broadcast real-time event to sender and team only after commit
			this.eventsGateway.emitSosStateChanged(trip.hostId, {
				sosId: alert.id,
				tripId: alert.tripId,
				senderId: alert.senderId,
				status: alert.status,
				closedBy: alert.closedBy,
				closedAt: alert.closedAt ? alert.closedAt.toISOString() : null,
				resolutionNote: alert.resolutionNote,
			});
		}

		return toSosAlertResponseDto(updatedAlert as unknown as SosAlert);
	}

	/**
	 * List all SOS alerts across trips owned by the authenticated Host.
	 */
	async listForHost(hostId: string, query: GetHostSosQueryDto): Promise<HostSosListResponseDto> {
		const page = query.page ?? 1;
		const limit = query.limit ?? 10;
		const { items, total } = await this.sosRepository.findForHost(hostId, {
			status: query.status,
			tripId: query.tripId,
			search: query.search,
			page,
			limit,
		});

		return {
			items: items.map(toSosAlertResponseDto),
			total,
			page,
			limit,
		};
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
	 * Helper to verify caller is the authorized Host of the Trip (CTMS-080, BR-261).
	 */
	private async assertTripHost(userId: string, tripId: string): Promise<SosTrip> {
		const trip = await this.findTripOrThrow(tripId);

		if (trip.hostId !== userId) {
			throw new ForbiddenException({
				statusCode: HttpStatus.FORBIDDEN,
				error: SosErrorCode.NOT_TRIP_HOST,
				message: "Chỉ chủ chuyến đi (Host) mới có quyền xử lý yêu cầu cứu trợ",
			});
		}
		return trip;
	}

	/**
	 * Helper to verify caller is an active participant (Camper, Porter, or Host) of the Trip.
	 */
	private async assertTripParticipant(userId: string, tripId: string): Promise<SosTrip> {
		const trip = await this.findTripOrThrow(tripId);

		const [camper, porter] = await Promise.all([
			this.participation.findCamperParticipation(tripId, userId),
			this.participation.findPorterAssignment(tripId, userId),
		]);

		const isParticipant = camper !== null || porter !== null || trip.hostId === userId;
		if (!isParticipant) {
			throw new ForbiddenException({
				statusCode: HttpStatus.FORBIDDEN,
				error: SosErrorCode.NOT_TRIP_PARTICIPANT,
				message: "Bạn không phải thành viên tham gia chuyến đi này",
			});
		}
		return trip;
	}

	/** The Trip with its Host resolved — the only recipient authorized for real-time SOS delivery. */
	private async findTripOrThrow(tripId: string): Promise<SosTrip> {
		const trip = await this.participation.findTrip(tripId);
		if (!trip?.hostId) {
			throw new NotFoundException({
				statusCode: HttpStatus.NOT_FOUND,
				error: SosErrorCode.TRIP_NOT_FOUND,
				message: "Không tìm thấy thông tin chuyến đi",
			});
		}
		return { ...trip, hostId: trip.hostId };
	}
}
