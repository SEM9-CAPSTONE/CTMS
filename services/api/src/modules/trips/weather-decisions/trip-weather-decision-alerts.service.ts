import { Injectable, Logger, Optional } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { EventsGateway } from "../../realtime/events.gateway";
import {
	WEATHER_ALERT_URGENCY,
	WEATHER_HOST_REMINDER_MS,
	type WeatherAlertMilestone,
	dueWeatherAlerts,
	weatherAlertMessage,
} from "./trip-weather-decision.policy";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import {
	type TripWeatherDecisionAlertRow,
	TripWeatherDecisionsRepository,
} from "./trip-weather-decisions.repository";

export interface WeatherAlertTarget {
	tripId: string;
	hostId: string;
	title: string;
	startsAt: Date;
	forecastId: string | null;
}

/**
 * Reminders of policy §5: T-48h to the Host, T-24h / T-12h / T-6h escalations and "Host kept a Red
 * Trip" to the Admins. Each reminder is stored once and pushed over the socket.
 */
@Injectable()
export class TripWeatherDecisionAlertsService {
	private readonly logger = new Logger(TripWeatherDecisionAlertsService.name);

	constructor(
		private readonly repository: TripWeatherDecisionsRepository,
		@Optional() private readonly events?: EventsGateway
	) {}

	/** Stores and pushes the given milestones; already-sent ones are skipped. */
	async send(
		target: WeatherAlertTarget,
		milestones: WeatherAlertMilestone[]
	): Promise<TripWeatherDecisionAlertRow[]> {
		if (milestones.length === 0) return [];
		const needsAdmins = milestones.some((milestone) => milestone !== "host_t48");
		const adminIds = needsAdmins ? await this.repository.findActiveAdminIds() : [];
		const rows = milestones.flatMap((milestone) =>
			(milestone === "host_t48" ? [target.hostId] : adminIds).map((recipientId) => ({
				recipientId,
				tripId: target.tripId,
				milestone,
				urgency: WEATHER_ALERT_URGENCY[milestone],
				tripTitle: target.title,
				tripStartsAt: target.startsAt,
				forecastId: target.forecastId,
			}))
		);
		const created = await this.repository.insertAlerts(rows);
		for (const alert of created) {
			this.events?.emitTripWeatherDecisionRequired([alert.recipientId], {
				alertId: alert.id,
				tripId: alert.tripId,
				tripTitle: alert.tripTitle,
				tripStartsAt: new Date(alert.tripStartsAt).toISOString(),
				milestone: alert.milestone,
				urgency: alert.urgency,
				message: weatherAlertMessage(alert.milestone, alert.tripTitle),
				createdAt: new Date(alert.createdAt).toISOString(),
			});
		}
		return created;
	}

	/**
	 * One worker pass: every published Red Trip starting within 48 h gets the reminders that are
	 * due now. A failure on one Trip is logged and does not stop the others.
	 */
	async sendDueAlerts(now: Date, limit: number): Promise<{ checked: number; sent: number }> {
		const candidates = await this.repository.findRedTripsStartingWithin(
			now,
			WEATHER_HOST_REMINDER_MS,
			limit
		);
		let sent = 0;
		for (const candidate of candidates) {
			try {
				const due = dueWeatherAlerts(
					{
						startsAt: new Date(candidate.startsAt),
						hostDecision: candidate.hostDecision,
						adminDecided: candidate.adminDecided,
					},
					now
				);
				const created = await this.send(
					{
						tripId: candidate.tripId,
						hostId: candidate.hostId,
						title: candidate.title,
						startsAt: new Date(candidate.startsAt),
						forecastId: candidate.forecastId,
					},
					due
				);
				sent += created.length;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.logger.warn(`Weather decision alert failed for trip ${candidate.tripId}: ${message}`);
			}
		}
		return { checked: candidates.length, sent };
	}
}
