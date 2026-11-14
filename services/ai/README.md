# CTMS AI Service

Python service for AI Survival Assistant, rule-based weather scoring, LLM advisories, and future RAG retrieval.

## Local Development

```bash
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```


## Trip review analysis (CTMS-411)

`POST /review-analysis` is an internal JSON endpoint protected by `X-CTMS-AI-Token`.
Set matching `AI_REVIEW_SERVICE_TOKEN` in API and AI processes; set `OPENAI_API_KEY`
only for the AI service. Nest resolves eligible review revisions and server model
configuration; this endpoint accepts only comment/model/config/prompt settings.
Missing credentials return a sanitized error rather than fallback insights.
No tools, numeric rating changes or image analysis are performed.

Run `python -m pytest app -q` for Python regression. Provider calls in tests are
fakes; see `docs/features/ctms-411-trip-review-ai-analysis.md` for live configuration,
queue/retry behavior, API contract and validation limits.


### Gemini provider support (2026-11-05)

### Personalized Trip recommendations (CTMS-106)

Trip recommendations use a separate Gemini client, independently of review analysis:

```env
GEMINI_API_KEY=your_google_ai_studio_key
TRIP_RECOMMENDATION_PROVIDER=gemini
TRIP_RECOMMENDATION_MODEL=gemini-3.1-flash-lite
TRIP_RECOMMENDATION_AI_ENABLED=true
TRIP_RECOMMENDATION_CACHE_HOURS=24
```

Create a key at https://aistudio.google.com/apikey using a Free Tier project.
Keep the key only in the AI service environment (or the root Docker Compose `.env`), never in
web/mobile configuration or Git. Keep `AI_REVIEW_SERVICE_TOKEN` identical in API and AI services.
Provider/model settings must match in API and AI; Docker Compose passes them to both.
Restart both services after configuration changes. Existing review/weather providers are unchanged.

The OpenAI SDK connects to Google's fixed compatibility endpoint; no OpenAI key is required
for recommendations. `gemini-3.1-flash-lite` has free input/output within Google's project limits:
https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite.
Actual quotas are shown in AI Studio, and paid projects may be billed; configuration cannot
detect your project's billing tier. No paid-model or alternate-provider fallback is automatic.

Only structured candidate attributes and aggregated permitted signals are sent. Google may use
Free Tier content to improve products. Cached AI order lasts at most 24 hours with unchanged
signals/configuration; current availability is always checked again. Concurrent identical
requests from one Camper share a pending rank call in the API process. A 429 triggers a
cooldown across all Campers in the AI service process, respecting Retry-After or defaulting
to 60 seconds. The current Docker service runs one worker; multiple AI replicas would need
a shared cooldown store. Missing keys, quota errors, invalid JSON and timeouts use rule ranking.
Python has a 4-second timeout without SDK retries; API has a 5-second timeout.

### Review analysis configuration

Review analysis supports `REVIEW_ANALYSIS_PROVIDER=openai|gemini` (default `openai`).
For Gemini, set `GEMINI_API_KEY`, `REVIEW_ANALYSIS_PROVIDER=gemini`,
`REVIEW_ANALYSIS_MODEL=gemini-3.1-flash-lite`, and
`REVIEW_ANALYSIS_CONFIG_VERSION=gemini-v1`. Keep API and AI service configuration aligned.
The API reads these values from its process environment; local runs must load the root `.env`
or configure the same non-secret review settings in `services/api/.env`.
Gemini uses Google's fixed OpenAI-compatible endpoint through the existing SDK;
no additional dependency, schema migration, source review changes or UI are required.
The internal shared token, strict output validation, PII redaction, timeouts, batch/lease
fencing and history rules remain in effect. Provider/model/config are part of result
identity, so switching provider does not reuse old provider results as current.
Weather advisory continues to use its existing OpenAI configuration.
Official compatibility guide: https://aistudio.google.com/docs/openai

A live synthetic-comment smoke test succeeded with `gemini-3.1-flash-lite`,
returning valid mixed sentiment, taxonomy topics, summary and token usage.
This verifies the provider edge, not the complete API/DB batch workflow or UI.

## Knowledge ingestion (CTMS-051)

The dedicated ingestion worker runs `app.knowledge_api:app` on port 8001 with
`requirements-ingestion.txt`, separate from the existing AI service. See
[CTMS-051 implementation](../../docs/features/CTMS-051-Implementation.md) for setup,
quality gates, version isolation and offline Recall@5 evaluation.
## Booking demand suggestions (CTMS-415)

`POST /demand-insight` uses the same internal shared-token protection and configured
OpenAI/Gemini client as review analysis. Nest sends only privacy-gated taxonomy cells,
ten-wide booker intervals, a closed month and server model/prompt settings. It never
sends source identities, names, prices, private questions or safety data.
The strict response selects only supplied cells with fixed advisory reason enums;
free-text numeric claims and unsupported candidates are rejected independently in
Python and Nest. SDK retries remain disabled. See
`docs/features/ctms-415-demand-insight-contract.md` for the public Host API, privacy
release policy, durable worker lifecycle, configuration and test limitations.
