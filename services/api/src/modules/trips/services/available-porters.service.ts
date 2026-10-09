import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { PaginatedAvailablePortersResponseDto } from "../dto/available-porter-response.dto";
import type { AvailablePortersQueryDto } from "../dto/available-porters-query.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { AvailablePortersRepository } from "../repositories/available-porters.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { PorterScheduleConflictSource } from "../repositories/porter-schedule-conflict-source";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripsRepository } from "../repositories/trips.repository";

@Injectable()
export class AvailablePortersService {
	constructor(
		private readonly tripsRepository: TripsRepository,
		private readonly availablePortersRepository: AvailablePortersRepository,
		private readonly scheduleConflictSource: PorterScheduleConflictSource
	) {}

	async search(
		hostId: string,
		tripId: string,
		query: AvailablePortersQueryDto
	): Promise<PaginatedAvailablePortersResponseDto> {
		const trip = await this.tripsRepository.findPorterAvailabilityContext(tripId);
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}
		if (trip.hostId !== hostId) {
			throw new ForbiddenException("Only the owning Host can search Porters for this Trip");
		}
		if (!trip.routeId || !trip.startsAt || !trip.endsAt || trip.startsAt >= trip.endsAt) {
			throw new ConflictException("Trip Route and schedule must be valid before searching Porters");
		}

		const excludedPorterIds = await this.scheduleConflictSource.findConflictingPorterIds({
			tripId,
			startsAt: trip.startsAt,
			endsAt: trip.endsAt,
		});
		const result = await this.availablePortersRepository.findEligibleCandidates({
			routeId: trip.routeId,
			role: query.role,
			minExperienceYears: query.minExperienceYears,
			excludedPorterIds,
			page: query.page,
			limit: query.limit,
		});

		return {
			items: result.items,
			pagination: {
				page: query.page,
				limit: query.limit,
				total: result.total,
				totalPages: Math.ceil(result.total / query.limit),
			},
		};
	}
}
