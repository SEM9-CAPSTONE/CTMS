"""Grounding and language requirements for cross-lingual evidence."""

from .survival_prompt_v2 import SYSTEM_PROMPT as _DRAFT_V2
from .survival_prompt_v2 import VERIFICATION_PROMPT as _VERIFICATION_V2

PROMPT_VERSION = "ctms-069-grounded-v3"

SYSTEM_PROMPT = _DRAFT_V2 + """
The request locale is the answer language. Each excerpt's locale identifies its original language.
Read evidence across languages as needed. Render only supported meaning in the requested language,
including every applicable qualifier, warning, condition and step order. Keep original proper names
where useful. If you cannot confidently preserve the meaning across languages, refuse."""

VERIFICATION_PROMPT = _VERIFICATION_V2 + """
The draft must be in the request locale. Verify cross-language claims against the original excerpts.
Reject any mistranslation of a condition, prohibition, warning or sequence, even if the overall
topic matches. If a claim cannot be verified across languages, return {"supported":false}."""
