import type { RoutePath } from "../../routes/routes.config";
import { OVERVIEW_TEXT, STATUS_LABELS } from "./constants";

export function overviewDate(value: string | null, timeZone: string): string {
	if (!value || !Number.isFinite(Date.parse(value))) return OVERVIEW_TEXT.unknown;
	try {
		return new Date(value).toLocaleString("vi-VN", {
			timeZone,
			dateStyle: "short",
			timeStyle: "short",
		});
	} catch {
		return OVERVIEW_TEXT.unknown;
	}
}
export const overviewStatus = (status: string | null) =>
	status ? (STATUS_LABELS[status] ?? OVERVIEW_TEXT.unknown) : OVERVIEW_TEXT.unknown;
export function openOverviewDetail(path: RoutePath, id?: string) {
	const target = id ? path.replace(/:(?:bookingId|id)/, encodeURIComponent(id)) : path;
	window.history.pushState({}, "", target);
	window.dispatchEvent(new PopStateEvent("popstate"));
}
