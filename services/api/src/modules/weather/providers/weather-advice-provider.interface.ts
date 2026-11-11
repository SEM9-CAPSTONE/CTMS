export const WEATHER_ADVICE_PROVIDER = Symbol("WEATHER_ADVICE_PROVIDER");

export interface CriterionForAdvice {
	value: number | boolean;
	level: string;
	weight: number;
	score: number;
}

/** Mirrors WeatherCriteriaScoresDetail exactly (CTMS-26's own entity) --
 * this is the one and only input the LLM is given, matching BR-075's
 * "may only explain the provided input data". */
export interface WeatherAdviceRequestPayload {
	riskLevel: string;
	compositeScore: number;
	rainfall: CriterionForAdvice;
	wind: CriterionForAdvice;
	temperature: CriterionForAdvice;
	visibility: CriterionForAdvice;
	thunderstorm: CriterionForAdvice;
}

/** Deliberately has no riskLevel/compositeScore field -- BR-076 structural
 * enforcement carries all the way from the Python service's own response
 * schema (see services/ai/app/models.py) up through this interface. */
export interface WeatherAdviceResult {
	adviceText: string;
	actions: string[];
}

/**
 * CTMS-29-T01. One provider implementation today (the Python `ai`
 * microservice, per the project's own docker-compose wiring:
 * `AI_SERVICE_URL` on the `api` container, `OPENAI_API_KEY` only on `ai`)
 * -- this interface exists so a later provider swap never touches
 * WeatherAdviceService's own retry/persistence logic, the same separation
 * of concerns as WeatherProvider/OtpNotificationProvider.
 */
export interface WeatherAdviceProvider {
	/**
	 * @throws WeatherAdviceProviderError on any non-2xx response, timeout, or
	 * malformed body -- WeatherAdviceService is the only place that decides
	 * what to do with a failure (retry, then surface a real error).
	 */
	generate(payload: WeatherAdviceRequestPayload): Promise<WeatherAdviceResult>;
}

export class WeatherAdviceProviderError extends Error {
	constructor(
		message: string,
		readonly cause?: unknown
	) {
		super(message);
		this.name = "WeatherAdviceProviderError";
	}
}
