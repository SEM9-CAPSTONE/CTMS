"""Generate and verify a grounded online survival answer."""

import asyncio
import hmac
import json
import os
import re
from datetime import UTC, datetime
from hashlib import sha256
from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from .survival_prompt_v2 import PROMPT_VERSION, SYSTEM_PROMPT, VERIFICATION_PROMPT

router = APIRouter()
MAX_REQUEST_BYTES = 16_384
MAX_PROMPT_BYTES = 18_000
MAX_MODEL_OUTPUT_BYTES = 4096
MAX_ANSWER_CHARS = 2600
MAX_PROVIDER_RESPONSE_BYTES = 16_384
MAX_COMPLETIONS = 4
MODEL_NAME = re.compile(r"[\w.:-]{1,128}", re.ASCII)
MAX_INPUT_TOKENS = 4096
CHAT_FORMAT_RESERVE = 64
RESPONSE_FORMAT = "json_object"
DRAFT_OUTPUT_TOKENS = 512
VERIFICATION_OUTPUT_TOKENS = 64
slots = asyncio.Semaphore(MAX_COMPLETIONS)

PROMPT_ARTIFACTS = {PROMPT_VERSION: {"draft": SYSTEM_PROMPT, "verification": VERIFICATION_PROMPT}}
PROMPT_DIGESTS = {
    stage: sha256(prompt.encode("utf-8")).hexdigest()
    for stage, prompt in PROMPT_ARTIFACTS[PROMPT_VERSION].items()
}

def resolve_prompt_artifact(version: str, stage: str, digest: str) -> str | None:
    prompt = PROMPT_ARTIFACTS.get(version, {}).get(stage)
    if prompt is not None and sha256(prompt.encode("utf-8")).hexdigest() == digest:
        return prompt
    return None


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chunkId: UUID
    headings: list[str] = Field(max_length=100)
    content: str = Field(min_length=1, max_length=MAX_REQUEST_BYTES)


class GenerationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=2000)
    locale: str = Field(pattern=r"^[a-z]{2,3}(?:-[A-Z]{2})?$")
    evidence: list[Evidence] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def validate_input(self):
        if not self.question.strip() or "\0" in self.question:
            raise ValueError("Invalid question")
        if len({chunk.chunkId for chunk in self.evidence}) != len(self.evidence):
            raise ValueError("Duplicate evidence")
        if any(not chunk.content.strip() for chunk in self.evidence):
            raise ValueError("Empty evidence")
        return self


class Draft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ANSWERED", "REFUSED"]
    answerText: str | None = Field(default=None, min_length=1, max_length=MAX_ANSWER_CHARS)
    usedEvidenceIds: list[UUID] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def validate_draft(self):
        if self.status == "REFUSED":
            if self.model_fields_set != {"status"}:
                raise ValueError("Refusal must contain only its status")
        elif (
            not self.answerText or not self.answerText.strip() or "\0" in self.answerText
            or not self.usedEvidenceIds or len(set(self.usedEvidenceIds)) != len(self.usedEvidenceIds)
        ):
            raise ValueError("Invalid grounded draft")
        return self


class Verification(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    supported: bool


def unavailable():
    return HTTPException(503, detail={"code": "AI_UNAVAILABLE"})


def require_token(x_ctms_survival_token: str | None = Header(default=None)):
    expected = os.getenv("AI_SURVIVAL_SERVICE_TOKEN", "").strip()
    if not expected:
        raise unavailable()
    if not x_ctms_survival_token or not hmac.compare_digest(
        expected.encode("utf-8"), x_ctms_survival_token.encode("utf-8")
    ):
        raise HTTPException(401, detail={"code": "AI_INTERNAL_UNAUTHORIZED"})


async def request_payload(request: Request) -> GenerationInput:
    body = bytearray()
    async for block in request.stream():
        if len(body) + len(block) > MAX_REQUEST_BYTES:
            raise HTTPException(413, detail={"code": "AI_INPUT_TOO_LARGE"})
        body.extend(block)
    try:
        return GenerationInput.model_validate_json(body)
    except ValidationError:
        raise HTTPException(422, detail={"code": "AI_INVALID_INPUT"}) from None


def provider_config() -> tuple[str, str, str, float]:
    provider = os.getenv("AI_SURVIVAL_PROVIDER", "openai").strip()
    if provider not in {"openai", "gemini"}:
        raise unavailable()
    model = os.getenv("AI_SURVIVAL_MODEL", "").strip()
    key = os.getenv("GEMINI_API_KEY" if provider == "gemini" else "OPENAI_API_KEY", "").strip()
    try:
        timeout = int(os.getenv("AI_SURVIVAL_LLM_TIMEOUT_MS", "3000")) / 1000
    except ValueError:
        raise unavailable() from None
    if not key or not MODEL_NAME.fullmatch(model) or not 0.1 <= timeout <= 7:
        raise unavailable()
    return provider, model, key, timeout


async def request_json(client: httpx.AsyncClient, url: str, headers: dict, request: dict) -> dict:
    async with client.stream("POST", url, json=request, headers=headers) as response:
        response.raise_for_status()
        body = bytearray()
        async for block in response.aiter_bytes():
            if len(body) + len(block) > MAX_PROVIDER_RESPONSE_BYTES:
                raise unavailable()
            body.extend(block)
        result = json.loads(body)
        if not isinstance(result, dict):
            raise unavailable()
        return result


async def request_completion(
    client: httpx.AsyncClient, provider: str, model: str, key: str,
    prompt: str, evidence: str, output_tokens: int,
) -> dict | None:
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": evidence},
    ]
    bearer = {"Authorization": f"Bearer {key}"}
    if provider == "gemini":
        root = "https://generativelanguage.googleapis.com/v1beta"
        count = await request_json(
            client, f"{root}/models/{model}:countTokens", {"x-goog-api-key": key},
            {"generateContentRequest": {
                "model": f"models/{model}",
                "systemInstruction": {"parts": [{"text": prompt}]},
                "contents": [{"role": "user", "parts": [{"text": evidence}]}],
            }},
        )
        tokens = count.get("totalTokens")
        url = f"{root}/openai/chat/completions"
    else:
        root = "https://api.openai.com/v1"
        count = await request_json(
            client, f"{root}/responses/input_tokens", bearer, {"model": model, "input": messages},
        )
        tokens = count.get("input_tokens")
        url = f"{root}/chat/completions"
    if type(tokens) is not int or tokens < 1:
        raise unavailable()
    if tokens + CHAT_FORMAT_RESERVE > MAX_INPUT_TOKENS:
        return None
    return await request_json(client, url, bearer, {
        "model": model,
        "messages": messages,
        "response_format": {"type": RESPONSE_FORMAT},
        output_token_parameter(provider): output_tokens,
    })


def output_token_parameter(provider: str) -> str:
    return "max_tokens" if provider == "gemini" else "max_completion_tokens"


def completion_content(completion: dict) -> str | None:
    choice = completion["choices"][0]
    message = choice["message"]
    if choice["finish_reason"] == "content_filter" or message.get("refusal"):
        return None
    raw = message.get("content")
    if (
        choice["finish_reason"] != "stop" or message.get("tool_calls") or not isinstance(raw, str)
        or len(raw.encode("utf-8")) > MAX_MODEL_OUTPUT_BYTES
    ):
        raise unavailable()
    return raw


async def generate_answer(payload: GenerationInput, *, include_trace: bool = False) -> dict:
    provider, model, key, timeout = provider_config()
    evidence_message = payload.model_dump_json()
    if len(SYSTEM_PROMPT.encode("utf-8")) + len(evidence_message.encode("utf-8")) > MAX_PROMPT_BYTES:
        raise HTTPException(413, detail={"code": "AI_INPUT_TOO_LARGE"})
    try:
        async with asyncio.timeout(timeout), httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            inference_started_at = datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            completion = await request_completion(
                client, provider, model, key, SYSTEM_PROMPT, evidence_message, DRAFT_OUTPUT_TOKENS
            )
            if completion is None:
                return {"status": "INSUFFICIENT_CONTEXT"}
            raw = completion_content(completion)
            if raw is None:
                return {"status": "REFUSED"}
            result = Draft.model_validate_json(raw)
            if result.status == "REFUSED":
                return {"status": "REFUSED"}
            allowed = {chunk.chunkId: chunk for chunk in payload.evidence}
            resolved_model = completion["model"]
            if not set(result.usedEvidenceIds) <= allowed.keys() or not MODEL_NAME.fullmatch(resolved_model):
                raise unavailable()
            used_evidence = [allowed[chunk_id] for chunk_id in result.usedEvidenceIds]
            verification_input = json.dumps({
                "question": payload.question,
                "locale": payload.locale,
                "answerText": result.answerText,
                "evidence": [chunk.model_dump(mode="json") for chunk in used_evidence],
            }, ensure_ascii=False, separators=(",", ":"))
            if len((VERIFICATION_PROMPT + verification_input).encode("utf-8")) > MAX_PROMPT_BYTES:
                return {"status": "INSUFFICIENT_CONTEXT"}
            verification = await request_completion(
                client, provider, model, key, VERIFICATION_PROMPT, verification_input, VERIFICATION_OUTPUT_TOKENS
            )
            if verification is None:
                return {"status": "INSUFFICIENT_CONTEXT"}
            verdict = completion_content(verification)
            if verdict is None or not Verification.model_validate_json(verdict).supported:
                return {"status": "REFUSED"}
            answered = {
                "status": "ANSWERED",
                "answerText": result.answerText,
                "usedEvidenceIds": [str(chunk_id) for chunk_id in result.usedEvidenceIds],
                "provider": provider,
                "model": resolved_model,
                "promptVersion": PROMPT_VERSION,
            }
            if include_trace:
                verification_model = verification.get("model")
                answered["trace"] = {
                    "inferenceStartedAt": inference_started_at,
                    "requestedModel": model,
                    "verificationModel": verification_model if (
                        isinstance(verification_model, str) and MODEL_NAME.fullmatch(verification_model)
                    ) else None,
                    "draft": {"promptSha256": PROMPT_DIGESTS["draft"], "maxOutputTokens": DRAFT_OUTPUT_TOKENS},
                    "verification": {
                        "promptSha256": PROMPT_DIGESTS["verification"],
                        "maxOutputTokens": VERIFICATION_OUTPUT_TOKENS,
                    },
                    "configuration": {
                        "outputTokenParameter": output_token_parameter(provider),
                        "responseFormat": RESPONSE_FORMAT,
                        "providerTimeoutMs": round(timeout * 1000),
                        "maxInputTokens": MAX_INPUT_TOKENS,
                        "chatFormatReserve": CHAT_FORMAT_RESERVE,
                        "maxPromptBytes": MAX_PROMPT_BYTES,
                    },
                }
            return answered
    except (TimeoutError, httpx.TimeoutException):
        raise HTTPException(504, detail={"code": "AI_TIMEOUT"}) from None
    except (httpx.HTTPError, ValidationError, ValueError, IndexError, KeyError, AttributeError, TypeError):
        raise unavailable() from None


@router.post("/internal/survival-answer", dependencies=[Depends(require_token)], include_in_schema=False)
async def survival_answer(
    payload: GenerationInput = Depends(request_payload),
    x_ctms_inference_trace: str | None = Header(default=None),
):
    if slots.locked():
        raise unavailable()
    async with slots:
        return await generate_answer(payload, include_trace=x_ctms_inference_trace == "1")
