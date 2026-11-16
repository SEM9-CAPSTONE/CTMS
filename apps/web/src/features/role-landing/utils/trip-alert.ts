import type { AlertSeverity, AlertType, TripAlert } from "../types/trip-alert";

export const alertTypeLabels: Record<AlertType, string> = {
	OFF_ROUTE: "Lệch tuyến",
	BEHIND_SCHEDULE: "Chậm tiến độ",
};
export const alertSeverityLabels: Record<AlertSeverity, string> = {
	BEHIND: "Chậm tiến độ",
	SEVERELY_BEHIND: "Chậm tiến độ nghiêm trọng",
};
export const alertSeverityFilterLabels: Record<AlertSeverity, string> = {
	BEHIND: "Chậm",
	SEVERELY_BEHIND: "Chậm nghiêm trọng",
};
export function filterTripAlerts(
	alerts: TripAlert[],
	type: AlertType | "",
	severity: AlertSeverity | ""
) {
	return alerts
		.filter(
			(alert) => (!type || alert.alertType === type) && (!severity || alert.severity === severity)
		)
		.sort((a, b) => {
			const rank = (alert: TripAlert) =>
				alert.severity === "SEVERELY_BEHIND" ? 2 : alert.severity === "BEHIND" ? 1 : 0;
			return rank(b) - rank(a) || Date.parse(b.observedAt) - Date.parse(a.observedAt);
		});
}
