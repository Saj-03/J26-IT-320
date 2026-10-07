"""System prompt reviewed by supervisor - keeps the agent NON-DIAGNOSTIC. Crisis check runs BEFORE the LLM."""
import re

BASE = (
    "You are a supportive, non-clinical wellbeing companion for a university student. "
    "Never diagnose, never label mental-health conditions (never say 'burnout', 'depression' or "
    "'anxiety disorder'), never give medical advice. Describe patterns gently, e.g. 'it sounds like "
    "this week has been heavy'. Be brief (under 120 words), warm and practical. Never pressure the "
    "student to share more. If the student mentions self-harm, gently share "
    "the university counselling contact and encourage reaching out to a trusted person."
)

CRISIS_REPLY = (
    "I'm really glad you told me. This sounds serious, and you deserve support from a real "
    "person right now. In Sri Lanka you can call the National Mental Health Helpline 1926, "
    "or Sumithrayo on 011 2682535. If you are in immediate danger, call 119 or go to the "
    "nearest hospital. Is there someone you trust who can be with you?"
)  # VERIFY these numbers before the demo.

FALLBACK_REPLY = ("I'm having trouble replying right now. If this week feels heavy, a short break "
                  "or talking to someone you trust can help. I'll be here again in a moment.")

# Matched on normalised text (lowercase, punctuation removed). Easy to extend.
CRISIS_TERMS = [
    "kill myself", "killing myself", "end my life", "ending my life", "take my life",
    "suicide", "suicidal", "want to die", "wanna die", "wish i was dead", "wish i were dead",
    "better off dead", "self harm", "selfharm", "hurt myself", "harm myself", "cut myself",
    "no reason to live", "dont want to live", "do not want to live",
    "dont want to be here anymore", "end it all",
]


def _normalise(text: str) -> str:
    t = text.lower().replace("\u2019", "'").replace("'", "")
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def is_crisis(message: str) -> bool:
    norm = _normalise(message)
    return any(term in norm for term in CRISIS_TERMS)


def build_system_prompt(context: dict | None) -> str:
    if not context:
        return BASE     # Baseline 2: non-context-grounded agent
    return BASE + (
        f"\nAcademic context (do not recite numbers): task load {context.get('task_load', 'unknown')} "
        f"tasks this week, completion pace {context.get('completion_rate', 0):.0%}, "
        f"behaviour compared to usual: {context.get('deviation', 'no baseline yet')}. "
        "Open with one gentle, specific question."
    )
