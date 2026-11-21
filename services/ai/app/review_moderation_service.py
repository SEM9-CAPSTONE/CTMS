"""CTMS-387: Review intelligence and moderation scanning service."""
import base64
import json
import mimetypes
import os
import unicodedata
import urllib.request
from typing import Literal, Optional

from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field, field_validator


PROMPT_VERSION = "v1"

TextFlagType = Literal["profanity_or_insult", "spam_or_irrelevant", "harassment"]
ImageFlagType = Literal["inappropriate_image"]
AspectType = Literal["safety", "guide_support", "equipment", "value"]
SentimentType = Literal["positive", "neutral", "negative"]
IncidentType = Literal["fall_slip", "injury", "lost_path", "weather_hazard", "other"]
OccurredType = Literal["yes", "warning", "unknown"]
SeverityType = Literal["minor", "moderate", "severe", "unknown"]
ChannelStatus = Literal["pending", "running", "completed", "failed", "unsupported", "not_applicable"]


class ReviewModerationError(Exception):
    pass


class InvalidModerationOutput(ReviewModerationError):
    pass


class ModerationProviderRefusal(ReviewModerationError):
    pass


class ModerationTextFlag(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    flag_type: TextFlagType
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: str = Field(min_length=1, max_length=1000)
    quote: str = Field(min_length=1, max_length=500)


class ModerationImageItem(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    image_index: int = Field(ge=0, le=4)
    storage_key: str = Field(min_length=1, max_length=255)
    scan_status: Literal["completed", "unsupported", "failed"]
    has_violation: Optional[bool] = None
    flag_type: Optional[ImageFlagType] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    evidence: Optional[str] = Field(default=None, max_length=1000)


class ModerationAspectSentiment(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    aspect: AspectType
    sentiment: SentimentType
    confidence: float = Field(ge=0.0, le=1.0)
    quote: Optional[str] = Field(default=None, min_length=1, max_length=500)


class ModerationIncidentSignal(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    incident_type: IncidentType
    occurred: OccurredType
    severity: SeverityType
    quote: str = Field(min_length=1, max_length=500)


class ReviewModerationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    comment: Optional[str] = Field(default=None, max_length=2000)
    images: list[str] = Field(default_factory=list, max_length=5)
    provider: str = Field(min_length=1, max_length=40)
    model: str = Field(min_length=1, max_length=200)
    config_version: str = Field(min_length=1, max_length=100)
    prompt_version: Literal["v1"]


class ReviewModerationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    text_scan_status: Literal["completed", "failed", "not_applicable"]
    image_scan_status: Literal["completed", "failed", "unsupported", "not_applicable"]
    aspects_status: Literal["completed", "failed", "not_applicable"]
    incidents_status: Literal["completed", "failed", "not_applicable"]
    flags: list[ModerationTextFlag] = Field(default_factory=list)
    image_items: list[ModerationImageItem] = Field(default_factory=list)
    aspect_sentiments: list[ModerationAspectSentiment] = Field(default_factory=list)
    incident_signals: list[ModerationIncidentSignal] = Field(default_factory=list)


SYSTEM_PROMPT = """You are the CTMS Trekking Review Intelligence Engine.
Analyze the provided masked review comment for a trekking trip across three text channels:
1. Moderation Flags: Identify any 'profanity_or_insult', 'spam_or_irrelevant', or 'harassment'.
   DO NOT flag phone numbers, emails, or PII (these are handled by server rules).
   DO NOT flag legitimate negative reviews, complaints about itinerary, food, weather, or guide service.
2. Aspect Sentiments: Evaluate the sentiments ('positive', 'neutral', 'negative') for applicable aspects:
   'safety', 'guide_support', 'equipment', 'value'.
3. Incident Signals: Extract safety incidents describing what happened on the trek:
   'fall_slip' (terrain slips/falls), 'injury' (bodily harm/medical distress), 'lost_path' (lost/trail deviation),
   'weather_hazard' (flood, storm, landslide), 'other' (other physical safety events).
   'occurred': 'yes' if the event actually happened to participants, 'warning' if caution/advice, 'unknown' if ambiguous.
   'severity': 'minor', 'moderate', 'severe', 'unknown'.

CRITICAL INVARIANTS:
- Every 'quote' MUST be an exact verbatim substring of the input comment. Never paraphrase or alter characters.
- Return ONLY a JSON object with this exact top-level schema (use empty arrays [] when none found):
{
  "flags": [
    {
      "flag_type": "profanity_or_insult" | "spam_or_irrelevant" | "harassment",
      "confidence": 0.0 to 1.0,
      "evidence": "Brief Vietnamese explanation of why it violates community standards",
      "quote": "exact verbatim substring from comment"
    }
  ],
  "aspect_sentiments": [
    {
      "aspect": "safety" | "guide_support" | "equipment" | "value",
      "sentiment": "positive" | "neutral" | "negative",
      "confidence": 0.0 to 1.0,
      "quote": "exact verbatim substring from comment or null"
    }
  ],
  "incident_signals": [
    {
      "incident_type": "fall_slip" | "injury" | "lost_path" | "weather_hazard" | "other",
      "occurred": "yes" | "warning" | "unknown",
      "severity": "minor" | "moderate" | "severe" | "unknown",
      "quote": "exact verbatim substring from comment"
    }
  ]
}
"""


IMAGE_MODERATION_PROMPT = """You are the CTMS Trekking Review Visual Safety Inspector.
Inspect the attached user-submitted photo for a trekking trip review.
Flag ONLY genuinely inappropriate visual content ('inappropriate_image'):
- Graphic violence, gore, severe wounds, weapons threats
- Nudity, sexually explicit content
- Hate symbols, offensive obscene gestures, or blatant commercial spam banners
DO NOT flag normal outdoor/trekking photos (mountains, trails, tents, campfires, hikers, food, mud, rain, equipment).

Return ONLY a JSON object with this exact schema:
{
  "has_violation": true | false,
  "flag_type": "inappropriate_image" | null,
  "confidence": 0.0 to 1.0,
  "evidence": "Brief Vietnamese explanation of what is shown"
}
"""

MAX_IMAGE_BYTES = 5 * 1024 * 1024


def normalize_nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def _load_image_as_data_url(image_ref: str) -> str:
    if image_ref.startswith("data:image/"):
        return image_ref
    if image_ref.startswith(("http://", "https://")):
        url = image_ref
    else:
        api_base = os.environ.get("CTMS_API_INTERNAL_URL", "http://host.docker.internal:3000").rstrip("/")
        path = image_ref if image_ref.startswith("/") else f"/{image_ref}"
        url = f"{api_base}{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "CTMS-AI-Moderation/1.0"})
    with urllib.request.urlopen(req, timeout=8) as resp:
        data = resp.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise InvalidModerationOutput("Image exceeds 5 MB moderation limit")
        content_type = resp.headers.get_content_type() or mimetypes.guess_type(url)[0] or "image/jpeg"
        if not content_type.startswith("image/"):
            content_type = "image/jpeg"
        encoded = base64.b64encode(data).decode("ascii")
        return f"data:{content_type};base64,{encoded}"


class ReviewModerationService:
    def __init__(self, client: OpenAI) -> None:
        self.client = client

    def _scan_single_image(self, idx: int, key: str, model: str) -> ModerationImageItem:
        try:
            data_url = _load_image_as_data_url(key)
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": IMAGE_MODERATION_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Inspect this review photo and return JSON."},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    },
                ],  # type: ignore[arg-type]
                temperature=0.0,
                response_format={"type": "json_object"},
            )
            choice = response.choices[0]
            if choice.finish_reason == "content_filter":
                return ModerationImageItem(
                    image_index=idx,
                    storage_key=key,
                    scan_status="completed",
                    has_violation=True,
                    flag_type="inappropriate_image",
                    confidence=0.95,
                    evidence="Hình ảnh bị bộ lọc an toàn tự động chặn do nội dung nhạy cảm.",
                )
            raw = choice.message.content
            if not raw:
                return ModerationImageItem(image_index=idx, storage_key=key, scan_status="failed")
            parsed = json.loads(raw)
            has_violation = bool(parsed.get("has_violation", False))
            raw_conf = parsed.get("confidence")
            confidence = float(raw_conf) if isinstance(raw_conf, (int, float)) else (0.85 if has_violation else 0.0)
            confidence = max(0.0, min(1.0, confidence))
            evidence = str(parsed.get("evidence") or "").strip()[:1000] or None
            return ModerationImageItem(
                image_index=idx,
                storage_key=key,
                scan_status="completed",
                has_violation=has_violation,
                flag_type="inappropriate_image" if has_violation else None,
                confidence=confidence if has_violation else None,
                evidence=evidence,
            )
        except Exception:
            return ModerationImageItem(image_index=idx, storage_key=key, scan_status="failed")

    def generate(self, payload: ReviewModerationRequest) -> ReviewModerationResponse:
        # 1. Handle Images
        image_items: list[ModerationImageItem] = []
        if not payload.images:
            image_scan_status: Literal["completed", "failed", "unsupported", "not_applicable"] = "not_applicable"
        else:
            vision_enabled = os.environ.get("REVIEW_MODERATION_VISION_ENABLED", "true").lower() == "true"
            if not vision_enabled:
                image_scan_status = "unsupported"
                for idx, key in enumerate(payload.images):
                    image_items.append(
                        ModerationImageItem(
                            image_index=idx,
                            storage_key=key,
                            scan_status="unsupported",
                            has_violation=None,
                            flag_type=None,
                            confidence=None,
                            evidence=None,
                        )
                    )
            else:
                any_failed = False
                any_completed = False
                for idx, key in enumerate(payload.images):
                    item = self._scan_single_image(idx, key, payload.model)
                    image_items.append(item)
                    if item.scan_status == "completed":
                        any_completed = True
                    elif item.scan_status == "failed":
                        any_failed = True
                image_scan_status = "completed" if any_completed else ("failed" if any_failed else "completed")

        # 2. Handle Text channels
        has_text = payload.comment is not None and len(payload.comment.strip()) > 0
        if not has_text:
            return ReviewModerationResponse(
                text_scan_status="not_applicable",
                image_scan_status=image_scan_status,
                aspects_status="not_applicable",
                incidents_status="not_applicable",
                flags=[],
                image_items=image_items,
                aspect_sentiments=[],
                incident_signals=[],
            )

        assert payload.comment is not None
        normalized_comment = normalize_nfc(payload.comment)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Review comment:\n{normalized_comment}"},
        ]

        response = self.client.chat.completions.create(
            model=payload.model,
            messages=messages,  # type: ignore[arg-type]
            temperature=0.0,
            response_format={"type": "json_object"},
        )

        choice = response.choices[0]
        if choice.finish_reason == "content_filter":
            raise ModerationProviderRefusal("Provider refused to process content")

        raw_content = choice.message.content
        if not raw_content:
            raise InvalidModerationOutput("Empty response content from provider")

        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError as err:
            raise InvalidModerationOutput(f"Invalid JSON from provider: {err}") from err

        flags: list[ModerationTextFlag] = []
        for raw_flag in parsed.get("flags", []):
            flag = ModerationTextFlag.model_validate(raw_flag)
            # Validate NFC substring
            normalized_quote = normalize_nfc(flag.quote)
            if normalized_quote not in normalized_comment:
                raise InvalidModerationOutput(f"Flag quote '{flag.quote}' is not a verbatim substring of comment")
            flags.append(flag)

        aspect_sentiments: list[ModerationAspectSentiment] = []
        seen_aspects: set[str] = set()
        raw_aspects = parsed.get("aspect_sentiments", [])
        if isinstance(raw_aspects, dict):
            normalized_aspects = []
            for aspect_key, aspect_val in raw_aspects.items():
                if isinstance(aspect_val, dict):
                    item = dict(aspect_val)
                    item.setdefault("aspect", aspect_key)
                    normalized_aspects.append(item)
            raw_aspects = normalized_aspects
        for raw_aspect in raw_aspects if isinstance(raw_aspects, list) else []:
            if not isinstance(raw_aspect, dict):
                continue
            aspect = ModerationAspectSentiment.model_validate(raw_aspect)
            if aspect.aspect in seen_aspects:
                continue
            seen_aspects.add(aspect.aspect)
            if aspect.quote:
                normalized_quote = normalize_nfc(aspect.quote)
                if normalized_quote not in normalized_comment:
                    raise InvalidModerationOutput(f"Aspect quote '{aspect.quote}' is not a verbatim substring of comment")
            aspect_sentiments.append(aspect)

        incident_signals: list[ModerationIncidentSignal] = []
        for raw_incident in parsed.get("incident_signals", []):
            incident = ModerationIncidentSignal.model_validate(raw_incident)
            normalized_quote = normalize_nfc(incident.quote)
            if normalized_quote not in normalized_comment:
                raise InvalidModerationOutput(f"Incident quote '{incident.quote}' is not a verbatim substring of comment")
            incident_signals.append(incident)

        return ReviewModerationResponse(
            text_scan_status="completed",
            image_scan_status=image_scan_status,
            aspects_status="completed",
            incidents_status="completed",
            flags=flags,
            image_items=image_items,
            aspect_sentiments=aspect_sentiments,
            incident_signals=incident_signals,
        )

