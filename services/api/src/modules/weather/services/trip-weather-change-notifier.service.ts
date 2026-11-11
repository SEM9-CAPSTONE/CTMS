import { Injectable, Logger, Optional } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { EventsGateway } from "../../realtime/events.gateway";
import type { TripWeatherForecast } from "../entities/trip-weather-forecast.entity";
import type { RiskLevel } from "../entities/weather-risk-assessment.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import {
	type TripWeatherChangeNoticeRow,
	TripWeatherChangeNoticesRepository,
} from "../repositories/trip-weather-change-notices.repository";

/**
 * CTMS-93 monitoring, policy §4: when the risk level of a Trip's forecast changes (Green / Yellow /
 * Red), the Host and the booked Campers get one notice each, stored and pushed over the socket.
 * A change of numbers within the same level is history only and notifies nobody.
 */
@Injectable()
export class TripWeatherChangeNotifier {
	private readonly logger = new Logger(TripWeatherChangeNotifier.name);

	constructor(
		private readonly notices: TripWeatherChangeNoticesRepository,
		@Optional() private readonly events?: EventsGateway
	) {}

	/**
	 * Called after a new forecast row was stored. `previousRiskLevel` is the level of the newest
	 * earlier forecast that had one; with no earlier level there is no change to announce.
	 * Never throws: a notification failure must not break the forecast itself.
	 */
	async notifyIfLevelChanged(
		forecast: TripWeatherForecast,
		previousRiskLevel: RiskLevel | null
	): Promise<TripWeatherChangeNoticeRow[]> {
		const riskLevel = forecast.riskLevel;
		if (!riskLevel || !previousRiskLevel || riskLevel === previousRiskLevel) return [];
		try {
			const [tripTitle, recipientIds] = await Promise.all([
				this.notices.findTripTitle(forecast.tripId),
				this.notices.findRecipientIds(forecast.tripId),
			]);
			const created = await this.notices.insertMany({
				recipientIds,
				tripId: forecast.tripId,
				forecastId: forecast.id,
				tripTitle: tripTitle ?? "Chuyến đi",
				tripStartsAt: forecast.tripStartsAt,
				previousRiskLevel,
				riskLevel,
			});
			if (created.length > 0) {
				this.events?.emitTripWeatherChanged(
					created.map((notice) => notice.recipientId),
					{
						eventId: forecast.id,
						tripId: forecast.tripId,
						tripTitle: created[0].tripTitle,
						tripStartsAt: new Date(forecast.tripStartsAt).toISOString(),
						previousRiskLevel,
						riskLevel,
						createdAt: new Date(created[0].createdAt).toISOString(),
					}
				);
			}
			return created;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Weather change notice failed for trip ${forecast.tripId}: ${message}`);
			return [];
		}
	}
}
