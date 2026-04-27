"""Anthropic Claude wrapper for interaction analysis.

This module is the *only* place the rest of the codebase talks to the LLM. It
builds a structured prompt from a list of ``Medication`` rows, asks Claude for
a JSON-only response, and validates that response against the
``LLMAnalysisResult`` Pydantic schema before returning it.

Privacy contract:
- Medication names, dosages, frequencies, and the LLM's raw response are
  PHI-equivalent. They are NEVER logged at INFO/DEBUG. Only sanitised counts
  and validation-failure shapes are emitted.

Test/dev contract:
- When ``ANTHROPIC_API_KEY`` is missing we return a deterministic stub result
  derived from the input medication list. This keeps tests offline and lets
  the rest of the stack be exercised without network calls.
"""
from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any

from pydantic import ValidationError

from app.config import settings
from app.schemas.interaction import LLMAnalysisResult

if TYPE_CHECKING:
    from app.models.medication import Medication

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = (
    "You are a clinical pharmacology assistant. You analyse a list of "
    "medications a single patient is taking and return a JSON object that "
    "describes potential drug-drug interactions. "
    "You MUST respond with ONLY a single JSON object - no prose, no markdown "
    "fences, no commentary. The JSON must conform exactly to this shape:\n"
    "{\n"
    '  "summary": string,\n'
    '  "edges": [\n'
    '    {"drug_a": string, "drug_b": string,\n'
    '     "severity": "red" | "yellow" | "green",\n'
    '     "explanation": string}\n'
    "  ],\n"
    '  "risks": [\n'
    '    {"rank": 1|2|3, "title": string, "plain_language": string}\n'
    "  ],\n"
    '  "doctor_questions": [string, string, string, ...]\n'
    "}\n"
    "Rules:\n"
    "- 'risks' MUST contain exactly 3 entries, one per rank (1, 2, 3).\n"
    "- 'doctor_questions' MUST contain at least 3 entries.\n"
    "- Severity is a traffic-light: red (dangerous), yellow (caution), "
    "green (likely safe).\n"
    "- All explanations must be plain-language, not clinical jargon.\n"
    "- Do not invent medications that are not in the input list."
)


def _build_user_prompt(medications: list["Medication"]) -> str:
    """Serialise the medication list into a deterministic prompt body."""
    lines = ["Patient is currently taking the following medications:"]
    for idx, med in enumerate(medications, start=1):
        lines.append(
            f"{idx}. name={med.name}; dosage={med.dosage}; frequency={med.frequency}"
        )
    lines.append(
        "Return the JSON object described in the system prompt for these "
        "medications."
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------
_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(raw: str) -> dict[str, Any]:
    """Extract the first JSON object from the LLM's text output.

    Defensive: the system prompt asks for JSON-only, but real-world models
    occasionally wrap JSON in ```json ... ``` fences. We strip those and pull
    the outermost ``{...}`` block.
    """
    candidate = raw.strip()
    if candidate.startswith("```"):
        # Strip leading ```json (or ```) and trailing ```
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate)
        candidate = re.sub(r"\s*```$", "", candidate)

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        match = _JSON_OBJECT_RE.search(candidate)
        if match is None:
            raise
        return json.loads(match.group(0))


# ---------------------------------------------------------------------------
# Stub fallback (offline / tests)
# ---------------------------------------------------------------------------
def _stub_result(medications: list["Medication"]) -> LLMAnalysisResult:
    """Deterministic offline result used when ``ANTHROPIC_API_KEY`` is unset.

    Builds a complete-graph of green edges and three placeholder risks. The
    output structure exactly matches the LLM contract so downstream code can
    be exercised without network calls.
    """
    edges = []
    for i in range(len(medications)):
        for j in range(i + 1, len(medications)):
            edges.append(
                {
                    "drug_a": medications[i].name,
                    "drug_b": medications[j].name,
                    "severity": "green",
                    "explanation": (
                        "Stub analysis: no interaction data available offline."
                    ),
                }
            )

    return LLMAnalysisResult.model_validate(
        {
            "summary": (
                "Offline stub analysis covering "
                f"{len(medications)} medications. Replace with a real "
                "ANTHROPIC_API_KEY for clinical content."
            ),
            "edges": edges,
            "risks": [
                {
                    "rank": 1,
                    "title": "Stub risk 1",
                    "plain_language": (
                        "This is a placeholder risk used in offline mode."
                    ),
                },
                {
                    "rank": 2,
                    "title": "Stub risk 2",
                    "plain_language": (
                        "This is a placeholder risk used in offline mode."
                    ),
                },
                {
                    "rank": 3,
                    "title": "Stub risk 3",
                    "plain_language": (
                        "This is a placeholder risk used in offline mode."
                    ),
                },
            ],
            "doctor_questions": [
                "Are any of my medications duplicating each other's effects?",
                "Are there foods or supplements I should avoid?",
                "When should I follow up about side effects?",
            ],
        }
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def analyze_interactions(medications: list["Medication"]) -> LLMAnalysisResult:
    """Run an interaction analysis and return a validated ``LLMAnalysisResult``.

    Args:
        medications: ordered list of ``Medication`` rows to analyse.

    Returns:
        A Pydantic-validated ``LLMAnalysisResult``.

    Raises:
        RuntimeError: with a sanitised message if the LLM is unavailable or
        returns content that fails Pydantic validation. The raw LLM output is
        never included in the exception message.
    """
    # Offline / test path
    if not settings.ANTHROPIC_API_KEY:
        logger.info(
            "llm.analyze.stub med_count=%d (no ANTHROPIC_API_KEY set)",
            len(medications),
        )
        return _stub_result(medications)

    # Real path - lazy import so the module remains importable without the SDK
    try:
        import anthropic  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover - environment-dependent
        logger.error("llm.analyze.sdk_missing")
        raise RuntimeError("LLM client unavailable: SDK not installed") from exc

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    user_prompt = _build_user_prompt(medications)

    try:
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except Exception as exc:  # noqa: BLE001 - sanitise & re-raise
        # Do NOT include exc args directly: SDK errors can echo prompt content.
        logger.error("llm.analyze.api_error type=%s", type(exc).__name__)
        raise RuntimeError("LLM API call failed") from exc

    # Pull the textual content out of the response
    try:
        text_blocks = [
            block.text  # type: ignore[union-attr]
            for block in response.content
            if getattr(block, "type", None) == "text"
        ]
        raw_text = "".join(text_blocks)
    except Exception as exc:  # noqa: BLE001
        logger.error("llm.analyze.unparseable_response_shape")
        raise RuntimeError("LLM response was not in the expected shape") from exc

    if not raw_text.strip():
        logger.error("llm.analyze.empty_response")
        raise RuntimeError("LLM returned an empty response")

    try:
        payload = _extract_json(raw_text)
    except json.JSONDecodeError as exc:
        logger.error("llm.analyze.invalid_json")
        raise RuntimeError("LLM response was not valid JSON") from exc

    try:
        result = LLMAnalysisResult.model_validate(payload)
    except ValidationError as exc:
        # Log only the validation-error *shape* (counts of failures), never
        # the offending field values, since those may carry medication names.
        logger.error(
            "llm.analyze.schema_violation error_count=%d",
            len(exc.errors()),
        )
        raise RuntimeError(
            "LLM response did not match the required analysis schema"
        ) from exc

    logger.info(
        "llm.analyze.ok edges=%d risks=%d questions=%d",
        len(result.edges),
        len(result.risks),
        len(result.doctor_questions),
    )
    return result


__all__ = ["analyze_interactions"]
