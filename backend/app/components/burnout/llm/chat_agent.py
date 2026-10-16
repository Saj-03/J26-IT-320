"""LLM conversational agent (Claude via the Anthropic Messages API). Key read from .env."""
import httpx
from app.core.config import settings

OFFLINE_REPLY = "I'm here with you. How has your week been going so far?"   # opening line when nothing is known

# Offline companion (used when no LLM_API_KEY is set, e.g. a demo without internet or credits).
# Rule-based on purpose: reflect what was said, ask ONE gentle open question, never diagnose or advise medically.
_THEMES = [
    (("sleep", "slept", "insomnia", "awake"), "Sleep has a big effect on everything else.",
     ["What has your sleep been like this week?", "What usually gets in the way of resting at night?"]),
    (("exam", "deadline", "assignment", "module", "viva", "presentation", "submission"),
     "That sounds like a lot of academic pressure.",
     ["Which one is weighing on you most right now?", "If you could take one thing off your plate this week, what would it be?"]),
    (("tired", "exhaust", "drained", "burnt", "burned", "overwhelm", "stress", "anxious", "worried", "worry", "cope", "pressure", "panic", "too much", "cant handle", "cannot handle"),
     "That sounds really draining.",
     ["When did it start to feel this heavy?", "What would feel like even a small relief today?"]),
    (("sad", "down", "low", "empty", "numb", "unmotivated", "hopeless", "cry", "crying", "fail", "failing", "behind", "useless", "not good enough"),
     "I'm sorry it feels like that.",
     ["What has been the hardest part of it?", "Has anything made it even a little lighter?"]),
    (("alone", "lonely", "nobody", "isolated"), "Feeling on your own with this is hard.",
     ["Is there someone you would feel okay talking to about it?", "Who is one person you feel comfortable around?"]),
    (("good", "great", "happy", "fine", "better", "proud"), "I'm glad to hear that.",
     ["What helped today go well?", "What would make tomorrow feel just as manageable?"]),
]
_GENERIC = [("Thanks for sharing that.", "How has it been affecting your days?"),
            ("I hear you.", "What would you like to be different this week?"),
            ("Okay, I'm listening.", "What part of it is on your mind the most?"),
            ("That makes sense.", "How are you looking after yourself at the moment?")]


_GREETING = {"hi", "hii", "hello", "hey", "heya", "yo", "good morning", "good evening", "good afternoon"}
_CLARIFY = ("what", "huh", "what do you mean", "what does that mean", "um", "is that all", "is that it", "why", "how", "what can you do")
_LOW_SHORT = {"bad", "not good", "not great", "awful", "terrible", "horrible", "meh", "not okay", "not ok", "so so", "rough"}
_NEUTRAL_SHORT = {"ok", "okay", "fine", "alright", "idk", "i dont know", "nothing", "not sure", "maybe", "yes", "no", "yeah", "nope"}


def _short_reply(norm: str, n_user: int) -> str | None:
    """Very short messages are about the conversation itself, not a topic. Answer them like a person would."""
    t = norm.strip(" ?!.,")
    if t in _GREETING:
        return "Hi! How are you feeling today, in a few words?"
    if t in _LOW_SHORT:
        return "I'm sorry it's been like that. What has been making it feel bad?"
    if t in _NEUTRAL_SHORT:
        return "That's okay, there's no rush. Is there anything on your mind, big or small?"
    if (t in _CLARIFY or t.startswith(("what do you", "what does", "what are you", "who are you", "are you", "what has", "um "))
            or "is that all" in t or "is that it" in t):
        return ("Sorry, I wasn't clear. I'm a simple companion that listens. You can tell me how your week is going, "
                "what is stressing you, or just how you feel today. Where would you like to start?")
    return None


def offline_reply(history: list[dict], context: dict | None = None) -> str:
    users = [m["content"] for m in history if m["role"] == "user"]
    if not users:
        return OFFLINE_REPLY
    text = users[-1].lower()
    norm = text.replace("'", "").replace("\u2019", "")
    short = _short_reply(norm, len(users))
    if short:
        return short
    theme = next(((e, q) for kw, e, q in _THEMES if any(k in norm for k in kw)), None)
    if theme:
        echo, questions = theme
        question = questions[(len(users) - 1) % len(questions)]
    else:                                   # nothing recognised: rotate through neutral replies, varied by message
        echo, question = _GENERIC[(len(users) + len(norm)) % len(_GENERIC)]
    extra = ""
    if context and context.get("deviation", "").startswith("quite different"):
        extra = " Your week does look busier than usual."
    return f"{echo}{extra} {question}"


async def _post(url: str, headers: dict, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        return r.json()


async def reply(system_prompt: str, history: list[dict], context: dict | None = None) -> str:
    if not settings.LLM_API_KEY:
        return offline_reply(history, context)
    if settings.LLM_PROVIDER == "openai":        # any OpenAI-compatible API (Groq, Gemini, OpenRouter...)
        base = (settings.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
        data = await _post(f"{base}/chat/completions",
                           {"Authorization": f"Bearer {settings.LLM_API_KEY}", "content-type": "application/json"},
                           {"model": settings.LLM_MODEL, "max_tokens": 300,
                            "messages": [{"role": "system", "content": system_prompt}, *history]})
        return data["choices"][0]["message"]["content"]
    # The API needs the first message to be from the user.
    while history and history[0]["role"] != "user":
        history = history[1:]
    data = await _post("https://api.anthropic.com/v1/messages",
                       {"x-api-key": settings.LLM_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                       {"model": settings.LLM_MODEL, "max_tokens": 300, "system": system_prompt, "messages": history})
    return data["content"][0]["text"]
