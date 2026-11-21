import { ConflictException, Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { DataSource, type EntityManager } from "typeorm";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { PackageActivationService } from "../../offline-packages/package-activation.service";
import { TrekkingRouteStatus } from "../../trekking-routes/entities/trekking-route.entity";
import {
	TripLifecycleBlock,
	type TripLifecycleResponseDto,
} from "../dto/trip-lifecycle-response.dto";
import { TripStatus } from "../entities/trip.entity";
import {
	type OperationalTrip,
	// biome-ignore lint/style/useImportType: Nest runtime injection metadata
	TripLifecycleRepository,
} from "../repositories/trip-lifecycle.repository";

@Injectable()
export class TripLifecycleService {
	constructor(
		private readonly db: DataSource,
		private readonly repository: TripLifecycleRepository,
		private readonly packages: PackageActivationService
	) {}

	context(porterId: string, tripId: string): Promise<TripLifecycleResponseDto> {
		return this.db.transaction(async (manager) => {
			const trip = await this.repository.assignedTrip(manager, porterId, tripId, false);
			return this.project(manager, trip);
		});
	}

	async transition(
		porterId: string,
		tripId: string,
		target: TripStatus.ONGOING | TripStatus.COMPLETED
	): Promise<TripLifecycleResponseDto> {
		const outcome = await this.db.transaction(async (manager) => {
			const trip = await this.repository.assignedTrip(manager, porterId, tripId, true);
			// Repeated requests from an authorized Porter preserve the original time and audit.
			if (trip.status === target) return { result: await this.project(manager, trip) };
			const expected = target === TripStatus.ONGOING ? TripStatus.PUBLISHED : TripStatus.ONGOING;
			if (trip.status !== expected) {
				throw new ConflictException({ code: TripLifecycleBlock.INVALID_STATE });
			}
			if (target === TripStatus.ONGOING) {
				const block = await this.startBlock(manager, trip);
				if (block) throw new ConflictException({ code: block });
				// Required packages cannot be bypassed by a feature flag or a retry.
				const departure = await this.packages.assertDepartureReady(manager, tripId);
				// Commit blocked-departure diagnostics without changing Trip state.
				if (!departure.ready) return { blocked: departure.reasonCode };
			}
			await this.repository.recordTransition(manager, trip, porterId, target);
			const changed = await this.repository.assignedTrip(manager, porterId, tripId, false);
			return { result: await this.project(manager, changed) };
		});
		if (outcome.blocked) throw new ConflictException({ code: outcome.blocked });
		if (!outcome.result) throw new Error("Lifecycle transition returned no result");
		return outcome.result;
	}

	private async startBlock(manager: EntityManager, trip: OperationalTrip): Promise<string | null> {
		if (trip.status !== TripStatus.PUBLISHED) return TripLifecycleBlock.INVALID_STATE;
		const [clock]: Array<{ now: Date }> = await manager.query("SELECT clock_timestamp() AS now");
		if (clock.now < trip.startsAt) return TripLifecycleBlock.TOO_EARLY;
		if (clock.now >= trip.endsAt) return TripLifecycleBlock.SCHEDULE_ENDED;
		if (trip.weatherPausedAt) return TripLifecycleBlock.WEATHER_PAUSED;
		if (trip.routeStatus !== TrekkingRouteStatus.ACTIVE)
			return TripLifecycleBlock.ROUTE_UNAVAILABLE;
		if (trip.confirmedParticipants < trip.capacityMin) {
			return TripLifecycleBlock.INSUFFICIENT_PARTICIPANTS;
		}
		return null;
	}

	private async project(
		manager: EntityManager,
		trip: OperationalTrip
	): Promise<TripLifecycleResponseDto> {
		let block = await this.startBlock(manager, trip);
		if (!block) {
			const departure = await this.packages.assertDepartureReady(manager, trip.tripId, false);
			if (!departure.ready) block = departure.reasonCode;
		}
		return {
			tripId: trip.tripId,
			title: trip.title,
			status: trip.status,
			startsAt: trip.startsAt,
			endsAt: trip.endsAt,
			actualStartedAt: trip.actualStartedAt,
			actualEndedAt: trip.actualEndedAt,
			canStart: block === null,
			canEnd: trip.status === TripStatus.ONGOING,
			startBlockedReason: trip.status === TripStatus.PUBLISHED ? block : null,
		};
	}
}
