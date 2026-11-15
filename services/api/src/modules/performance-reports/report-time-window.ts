import { ReportPeriodPreset } from "./dto/get-performance-report-query.dto";

export interface ResolvedTimeWindow {
	from: Date;
	to: Date;
	preset?: string;
}

export interface ReportTimeWindowQuery {
	from?: string;
	to?: string;
	period?: ReportPeriodPreset;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Shared by the performance (CTMS-101) and revenue (CTMS-110) reports so both resolve a period
 * preset to exactly the same window.
 */
export function resolveReportTimeWindow(
	query: ReportTimeWindowQuery,
	now: Date = new Date()
): ResolvedTimeWindow {
	if (query.from && query.to) {
		return { from: new Date(query.from), to: new Date(query.to), preset: undefined };
	}

	const preset = query.period ?? ReportPeriodPreset.DAYS_30;
	switch (preset) {
		case ReportPeriodPreset.DAYS_7:
			return { from: new Date(now.getTime() - 7 * DAY_MS), to: now, preset };
		case ReportPeriodPreset.DAYS_30:
			return { from: new Date(now.getTime() - 30 * DAY_MS), to: now, preset };
		case ReportPeriodPreset.DAYS_90:
			return { from: new Date(now.getTime() - 90 * DAY_MS), to: now, preset };
		case ReportPeriodPreset.MONTHS_12:
			return { from: new Date(now.getTime() - 365 * DAY_MS), to: now, preset };
		case ReportPeriodPreset.THIS_MONTH:
			return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now, preset };
		case ReportPeriodPreset.LAST_MONTH:
			return {
				from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
				to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
				preset,
			};
		default:
			return { from: new Date(2020, 0, 1), to: now, preset };
	}
}
