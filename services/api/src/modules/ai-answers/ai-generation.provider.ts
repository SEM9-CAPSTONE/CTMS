import { Injectable, ServiceUnavailableException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import { aiUnavailable, parseGeneration } from "./ai-answers.policy";

const MAX_INTERNAL_RESPONSE_BYTES = 4096;
const DEFAULT_PROVIDER_TIMEOUT_MS = 3500;

@Injectable()
export class AiGenerationProvider {
	constructor(private readonly config: ConfigService) {}

	async generate(body: string, signal: AbortSignal) {
		const token = this.config.get<string>("AI_SURVIVAL_SERVICE_TOKEN")?.trim();
		const timeout = Number(
			this.config.get<string>("AI_SURVIVAL_INTERNAL_TIMEOUT_MS") ?? DEFAULT_PROVIDER_TIMEOUT_MS
		);
		if (!token || !Number.isInteger(timeout) || timeout < 100 || timeout > 7500) {
			throw aiUnavailable();
		}
		try {
			const base = this.config.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000";
			const response = await fetch(`${base.replace(/\/$/, "")}/internal/survival-answer`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "X-CTMS-Survival-Token": token },
				body,
				signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]),
				redirect: "error",
			});
			if (!response.ok || !response.body) {
				await response.body?.cancel();
				if (response.status === 504) throw aiUnavailable("AI_TIMEOUT");
				throw aiUnavailable();
			}
			const reader = response.body.getReader();
			const buffers: Uint8Array[] = [];
			let size = 0;
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				size += value.byteLength;
				if (size > MAX_INTERNAL_RESPONSE_BYTES) {
					await reader.cancel();
					throw aiUnavailable();
				}
				buffers.push(value);
			}
			return parseGeneration(JSON.parse(Buffer.concat(buffers).toString("utf8")) as unknown);
		} catch (error) {
			if (error instanceof Error && error.name === "TimeoutError") {
				throw aiUnavailable("AI_TIMEOUT");
			}
			if (error instanceof ServiceUnavailableException) throw error;
			throw aiUnavailable();
		}
	}
}
