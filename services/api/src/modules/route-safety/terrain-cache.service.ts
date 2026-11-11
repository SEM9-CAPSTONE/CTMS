import { Injectable, type OnModuleDestroy } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { TERRAIN } from "./terrain.policy";
import type { TerrainResult } from "./terrain.types";

@Injectable()
export class TerrainCacheService implements OnModuleDestroy {
	private readonly memory = new Map<string, { expires: number; result: TerrainResult }>();
	private readonly redis?: Redis;
	constructor(config: ConfigService) {
		const url = config.get<string>("REDIS_URL");
		if (url) {
			this.redis = new Redis(url, {
				lazyConnect: true,
				maxRetriesPerRequest: 0,
				connectTimeout: 1000,
				retryStrategy: () => null,
			});
			this.redis.on("error", () => {
				/* Memory cache keeps analysis usable without Redis. */
			});
		}
	}
	async get(key: string): Promise<TerrainResult | undefined> {
		const cached = this.memory.get(key);
		if (cached && cached.expires > Date.now()) return cached.result;
		this.memory.delete(key);
		try {
			const value = await this.redis?.get(key);
			if (value) {
				const result = JSON.parse(value) as TerrainResult;
				if (
					result.status === "READY" &&
					Array.isArray(result.profile) &&
					Number.isFinite(result.minimumMinutes) &&
					result.minimumMinutes > 0 &&
					Number.isFinite(result.estimatedMinutes) &&
					result.estimatedMinutes >= result.minimumMinutes &&
					Array.isArray(result.legs)
				) {
					this.remember(key, result);
					return result;
				}
			}
		} catch {
			/* A cache outage must not prevent analysis. */
		}
		return undefined;
	}
	async set(key: string, result: TerrainResult): Promise<void> {
		this.remember(key, result);
		try {
			await this.redis?.set(key, JSON.stringify(result), "EX", TERRAIN.cacheSeconds);
		} catch {
			/* The bounded memory cache remains available. */
		}
	}
	private remember(key: string, result: TerrainResult): void {
		if (this.memory.size >= TERRAIN.cacheEntries) {
			const oldest = this.memory.keys().next().value;
			if (oldest) this.memory.delete(oldest);
		}
		this.memory.set(key, { result, expires: Date.now() + TERRAIN.cacheSeconds * 1000 });
	}
	onModuleDestroy(): void {
		this.redis?.disconnect();
	}
}
