import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import type { LiveSafetySnapshot } from "./live-safety.types";
import { providerUrl, readProviderJson } from "./nchmf-http";
import { ROUTE_CONTEXT, sourceStatus } from "./route-context.policy";
import { configuredNumber } from "./route-safety.policy";
import { vndmsEvent } from "./vndms-event";

@Injectable()
export class VndmsSafetyService {
	private readonly logger = new Logger(VndmsSafetyService.name);
	constructor(private readonly config: ConfigService) {}

	async collect(): Promise<LiveSafetySnapshot> {
		const source = sourceStatus("VNDMS");
		if (this.config.get<string>("ROUTE_SAFETY_VNDMS_ENABLED") === "false") {
			return { source: { ...source, status: "DISABLED" }, candidates: [] };
		}
		try {
			const signal = AbortSignal.timeout(
				configuredNumber(
					this.config.get<string>("ROUTE_SAFETY_CONTEXT_TIMEOUT_MS"),
					ROUTE_CONTEXT.timeoutMs,
					1000,
					30000
				)
			);
			const base = providerUrl(
				this.config.get<string>("ROUTE_SAFETY_VNDMS_BASE_URL") ?? ROUTE_CONTEXT.vndmsUrl
			);
			const year = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
			const results = await Promise.allSettled(
				[year, year - 1].map(async (value) => {
					const url = new URL(ROUTE_CONTEXT.vndmsPath, base);
					url.search = new URLSearchParams({ year: String(value), keyword: "" }).toString();
					const rows = await readProviderJson(url, { signal });
					if (!Array.isArray(rows) || rows.length > ROUTE_CONTEXT.maxRecords)
						throw new Error("Invalid VNDMS list");
					return rows;
				})
			);
			const candidates = new Map<string, NonNullable<ReturnType<typeof vndmsEvent>>>();
			let partial = false;
			let available = false;
			for (const result of results) {
				if (result.status === "rejected") {
					partial = true;
					continue;
				}
				available = true;
				for (const row of result.value) {
					try {
						const event = vndmsEvent(
							row,
							source.checkedAt,
							new URL(ROUTE_CONTEXT.vndmsPath, base).href
						);
						if (event) candidates.set(event.id, event);
						else partial = true;
					} catch {
						partial = true;
					}
				}
			}
			const records = [...candidates.values()];
			return {
				source: {
					...source,
					status: !available
						? "UNAVAILABLE"
						: partial
							? "PARTIAL"
							: records.length
								? "LIVE"
								: "EMPTY",
					dataTime:
						records
							.map((r) => r.updatedAt)
							.sort()
							.at(-1) ?? null,
				},
				candidates: records,
			};
		} catch {
			this.logger.warn("VNDMS collection failed; event data unavailable");
			return { source, candidates: [] };
		}
	}
}
