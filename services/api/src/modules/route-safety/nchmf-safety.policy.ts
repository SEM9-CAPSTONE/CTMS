import type { SafetySeverity } from "./route-safety.types";

export const NCHMF = {
	baseUrl: "https://luquetsatlo.nchmf.gov.vn",
	boundariesUrl: "https://geosllq.vndss.com/geoserversllq/ows",
	warningsPath: "/LayerMapBox/getDSCanhbaoSLLQ",
	boundaryLayer: "cwrs_sllq:bgmap_commune",
	forecastHours: 6,
	lookbackHours: 2,
	timeoutMs: 12000,
	maxResponseBytes: 16 * 1024 * 1024,
	maxWarningRows: 20000,
	maxBoundaries: 1000,
	hourMs: 3600000,
	vietnamOffsetMs: 7 * 3600000,
} as const;

export const NCHMF_SEVERITY: Readonly<Record<string, SafetySeverity>> = {
	"Trung bình": "MEDIUM",
	Cao: "HIGH",
	"Rất cao": "VERY_HIGH",
};

export function nchmfDate(value: unknown): string {
	if (typeof value !== "string") throw new Error("Invalid NCHMF timestamp");
	const match = /^\/Date\((\d+)\)\/$/.exec(value);
	const milliseconds = match ? Number(match[1]) : Number.NaN;
	if (!Number.isFinite(milliseconds)) throw new Error("Invalid NCHMF timestamp");
	return new Date(milliseconds).toISOString();
}

export function nchmfHour(now: number): string {
	return new Date(Math.floor(now / NCHMF.hourMs) * NCHMF.hourMs + NCHMF.vietnamOffsetMs)
		.toISOString()
		.slice(0, 19)
		.replace("T", " ");
}
