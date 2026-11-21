"""Exercise the running container's real generation/verification path.

From the project root (PowerShell):
  Get-Content -Raw scripts/diagnose-survival-ai.py | docker compose exec -T ai python -B -

Uses a fixed planning excerpt, calls the configured provider, and writes no app
data. Never prints credentials, provider response bodies or generated answers.
"""

import asyncio
import inspect
import json
import os
import time
from uuid import uuid4

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from app import survival_answers as service


def emit(stage, **values):
    print(json.dumps({"stage": stage, **values}, ensure_ascii=True), flush=True)


async def main():
    emit("configuration", key_configured=bool(os.getenv("GEMINI_API_KEY", "").strip())
         if os.getenv("AI_SURVIVAL_PROVIDER", "openai").strip() == "gemini"
         else bool(os.getenv("OPENAI_API_KEY", "").strip()),
         service_token_configured=bool(os.getenv("AI_SURVIVAL_SERVICE_TOKEN", "").strip()))
    try:
        provider, model, _, timeout = service.provider_config()
    except HTTPException as error:
        emit("configuration_error", http_status=error.status_code)
        return 1
    emit("provider", provider=provider, model=model, timeout_ms=round(timeout * 1000))

    try:
        payload = service.GenerationInput.model_validate({
            "question": "T\u00f4i s\u1eafp \u0111i trekking, t\u00f4i c\u1ea7n chu\u1ea9n b\u1ecb nh\u1eefng g\u00ec?",
            "locale": "vi",
            "evidence": [{
                "chunkId": str(uuid4()), "locale": "en",
                "headings": ["KNOW BEFORE YOU GO"],
                "content": "- Pack the 10 essentials\n- Share your Trip Plan with Trusted Contact\n- Create an Emergency Plan",
            }],
        })
    except ValidationError as error:
        emit("input_contract_error", fields=[".".join(map(str, item["loc"])) for item in error.errors()])
        return 1

    original = service.request_json
    step = 0

    async def observed(client, url, headers, request):
        nonlocal step
        step += 1
        current = step
        kind = "count_tokens" if url.endswith((":countTokens", "/input_tokens")) else "completion"
        started = time.monotonic()
        emit("upstream_start", step=current, operation=kind)
        try:
            result = await original(client, url, headers, request)
        except httpx.HTTPStatusError as error:
            emit("upstream_http_error", step=current, operation=kind,
                 http_status=error.response.status_code,
                 duration_ms=round((time.monotonic() - started) * 1000))
            raise
        except Exception as error:
            emit("upstream_exception", step=current, operation=kind, error_type=type(error).__name__)
            raise
        details = {}
        if kind == "completion":
            choices = result.get("choices")
            choice = choices[0] if isinstance(choices, list) and choices and isinstance(choices[0], dict) else {}
            reason = choice.get("finish_reason")
            details["finish_reason"] = reason if reason in {"stop", "length", "content_filter", "tool_calls"} else "other"
            message = choice.get("message")
            content = message.get("content") if isinstance(message, dict) else None
            details["content_present"] = isinstance(content, str) and bool(content.strip())
            details["json_valid"] = False
            if isinstance(content, str):
                try:
                    decoded = json.loads(content)
                    details["json_valid"] = isinstance(decoded, dict)
                except (ValueError, TypeError):
                    pass
        emit("upstream_ok", step=current, operation=kind,
             duration_ms=round((time.monotonic() - started) * 1000), **details)
        return result

    service.request_json = observed
    started = time.monotonic()
    try:
        trace = {"include_trace": True} if "include_trace" in inspect.signature(service.generate_answer).parameters else {}
        result = await service.generate_answer(payload, **trace)
        status = result.get("status")
        emit("generation_result", status=status if status in {"ANSWERED", "REFUSED", "INSUFFICIENT_CONTEXT"} else "INVALID",
             duration_ms=round((time.monotonic() - started) * 1000), upstream_steps=step)
        return 0 if status == "ANSWERED" else 1
    except HTTPException as error:
        code = error.detail.get("code") if isinstance(error.detail, dict) else None
        emit("generation_error", http_status=error.status_code,
             code=code if code in {"AI_UNAVAILABLE", "AI_TIMEOUT", "AI_INPUT_TOO_LARGE"} else "other",
             duration_ms=round((time.monotonic() - started) * 1000), upstream_steps=step)
        return 1
    except Exception as error:
        emit("generation_exception", error_type=type(error).__name__, upstream_steps=step)
        return 1
    finally:
        service.request_json = original


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
