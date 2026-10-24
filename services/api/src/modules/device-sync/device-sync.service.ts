import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
import { GPS_TRACKING_CONFIG_VERSION } from "../gps-tracking/gps-tracking.constants";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { DeviceSyncRepository } from "./device-sync.repository";
import type { DeviceSyncStatusResponseDto } from "./dto/device-sync-status-response.dto";

@Injectable()
export class DeviceSyncService {
	constructor(
		private readonly participation: GpsParticipationSource,
		private readonly repository: DeviceSyncRepository
	) {}

	async getSyncStatus(
		userId: string,
		userRoles: string[],
		tripId: string
	): Promise<DeviceSyncStatusResponseDto> {
		const trip = await this.participation.findTrip(tripId);
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}

		const hostId = await this.repository.getTripHostId(tripId);
		const isHost = hostId === userId && userRoles.includes(UserRole.HOST);

		const [camper, porter] = await Promise.all([
			this.participation.findCamperParticipation(tripId, userId),
			this.participation.findPorterAssignment(tripId, userId),
		]);

		let resolvedRole: "host" | "porter" | "camper" | null = null;
		if (isHost) {
			resolvedRole = "host";
		} else if (porter?.assigned) {
			resolvedRole = "porter";
		} else if (
			camper?.memberStatus === BookingMemberStatus.JOINED ||
			camper?.memberStatus === BookingMemberStatus.LEFT
		) {
			resolvedRole = "camper";
		} else if (porter !== null) {
			resolvedRole = "porter";
		} else if (camper !== null) {
			resolvedRole = "camper";
		}

		if (!resolvedRole) {
			throw new ForbiddenException(
				"You are not authorized to view synchronization status for this Trip"
			);
		}

		// Fetch authoritative server-confirmed statistics (BR-226)
		const stats = await this.repository.getParticipantSyncStats(tripId, userId);

		let membersSyncHealth: DeviceSyncStatusResponseDto["membersSyncHealth"];
		if (isHost) {
			membersSyncHealth = await this.repository.getTripParticipantsSyncHealth(tripId);
		}

		return {
			tripId,
			userId,
			participantRole: resolvedRole,
			serverConfirmedGpsCount: stats.gpsCount,
			serverConfirmedSafetyCount: stats.safetyCount,
			lastReceivedAt: stats.lastReceivedAt ? stats.lastReceivedAt.toISOString() : null,
			packageVersion: stats.packageVersion,
			configVersion: GPS_TRACKING_CONFIG_VERSION,
			...(membersSyncHealth ? { membersSyncHealth } : {}),
		};
	}
}
