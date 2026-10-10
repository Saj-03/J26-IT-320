"""
AI Interview Simulator - answer evaluation.

VIVA: "Each answer gets up to three scores:
  1. Content (always): semantic similarity to a model answer (SBERT),
     coverage of key concepts, and STAR structure for behavioural answers.
  2. Delivery (voice mode): speaking pace (words per minute) and filler words,
     computed from the browser transcript and speaking time.
  3. Presentation (camera mode): face-in-frame and facing-camera ratios,
     computed in the browser by MediaPipe - only these numbers reach the server.
Raw audio/video is never sent or stored, and there is no emotion or
personality detection. Feedback is advisory."
"""
import os
import re
from functools import lru_cache
from typing import Optional

ADVISORY_NOTE = "Interview practice feedback is advisory."

# Overall score weights (re-normalised when a component is not available).
WEIGHTS = {"content": 0.6, "delivery": 0.25, "presentation": 0.15}

# Content score = 50% meaning + 35% key concepts + 15% structure/length.
CONTENT_WEIGHTS = {"semantic": 0.5, "keywords": 0.35, "form": 0.15}

IDEAL_WPM = (110, 160)
FILLERS = ["um", "uh", "er", "ah", "hmm", "you know", "i mean", "basically",
           "actually", "literally", "kind of", "sort of"]

# Cue phrases for the STAR method (Situation, Task, Action, Result).
STAR_CUES = {
    "situation": ["during", "when i", "when we", "in my", "at my", "situation", "project", "while"],
    "task": ["my task", "my role", "responsible", "had to", "needed to", "my goal", "was asked", "assigned"],
    "action": ["i decided", "i created", "i built", "i organised", "i organized", "i arranged", "i suggested",
               "i implemented", "i analysed", "i analyzed", "i talked", "i spoke", "i used", "i worked",
               "i measured", "i rewrote", "i asked", "so i", "i then", "then i"],
    "result": ["as a result", "result", "outcome", "finally", "improved", "reduced", "increased",
               "results", "achieved", "delivered", "completed", "succeeded", "learned", "learnt"],
}


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------
def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", (text or "").lower())


# Longest first, so 'normalization' -> 'normal' (matches 'normalize', 'normalisation').
SUFFIXES = ("izations", "isations", "ization", "isation", "ations", "ation", "ments", "ment",
            "ances", "ance", "ences", "ence", "ities", "ity", "ings", "ing", "isms", "ism",
            "ness", "ers", "er", "ied", "ies", "ize", "ise", "ed", "es", "s")


def stem(token: str) -> str:
    for suffix in SUFFIXES:
        if token.endswith(suffix) and len(token) - len(suffix) >= 4:
            return token[: -len(suffix)]
    return token


def _token_match(keyword_tok: str, word: str) -> bool:
    """Light stemming: 'testing' matches 'tests', 'encapsulation' matches 'encapsulate'."""
    if len(keyword_tok) <= 3:
        return word in (keyword_tok, keyword_tok + "s")
    return word.startswith(stem(keyword_tok))


def _phrase_in(phrase: str, words: list[str]) -> bool:
    """True if the phrase's tokens appear consecutively in the answer."""
    toks = tokenize(phrase)
    if not toks:
        return False
    for i in range(len(words) - len(toks) + 1):
        if all(_token_match(t, words[i + j]) for j, t in enumerate(toks)):
            return True
    return False


def keyword_coverage(answer: str, keywords: list[str]) -> tuple[float, list[str], list[str]]:
    """Each keyword may list alternatives separated by '|'. Returns (ratio, matched, missing)."""
    words = tokenize(answer)
    matched, missing = [], []
    for kw in keywords:
        alternatives = kw.split("|")
        (matched if any(_phrase_in(a, words) for a in alternatives) else missing).append(alternatives[0])
    return (len(matched) / len(keywords) if keywords else 0.0), matched, missing


# ---------------------------------------------------------------------------
# Semantic similarity: SBERT if available, TF-IDF cosine as a fallback
# ---------------------------------------------------------------------------
@lru_cache
def _sbert():
    """Load SBERT once. Returns None if disabled, not installed, or offline."""
    if os.getenv("ACRDS_USE_SBERT", "1") == "0":
        return None
    try:
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def _scale(value: float, low: float, high: float) -> float:
    """Map value from [low, high] to [0, 1], clipped."""
    return max(0.0, min(1.0, (value - low) / (high - low)))


def semantic_similarity(answer: str, reference: str) -> tuple[float, str]:
    """Returns (score 0-1, method). Raw cosine values are rescaled so a
    clearly relevant answer reaches ~1.0 and an unrelated one ~0."""
    model = _sbert()
    if model is not None:
        from sentence_transformers import util
        emb = model.encode([answer, reference])
        cos = float(util.cos_sim(emb[0], emb[1]))
        return _scale(cos, 0.15, 0.75), "SBERT (all-MiniLM-L6-v2)"

    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    try:
        matrix = TfidfVectorizer(stop_words="english").fit_transform([answer, reference])
        cos = float(cosine_similarity(matrix[0], matrix[1])[0][0])
    except ValueError:  # answer contains only stop words
        cos = 0.0
    return _scale(cos, 0.0, 0.45), "TF-IDF cosine (fallback)"


# ---------------------------------------------------------------------------
# Component scores
# ---------------------------------------------------------------------------
def star_structure(answer: str) -> dict:
    text = " " + " ".join(tokenize(answer)) + " "
    found = {part: any(f" {cue} " in text for cue in cues) for part, cues in STAR_CUES.items()}
    return {**found, "score": round(sum(found.values()) / 4 * 100, 1)}


def length_score(word_count: int) -> float:
    if word_count < 40:
        return word_count / 40
    if word_count > 250:
        return 0.8
    return 1.0


def score_content(question: dict, answer: str) -> dict:
    word_count = len(tokenize(answer))
    semantic, method = semantic_similarity(answer, question["model_answer"])
    coverage, matched, missing = keyword_coverage(answer, question["keywords"])

    structure = star_structure(answer) if question["category"] == "Behavioural" else None
    form = structure["score"] / 100 if structure else length_score(word_count)

    score = 100 * (CONTENT_WEIGHTS["semantic"] * semantic
                   + CONTENT_WEIGHTS["keywords"] * coverage
                   + CONTENT_WEIGHTS["form"] * form)
    # Very short answers cannot be strong, whatever they contain.
    score *= min(1.0, 0.4 + word_count / 40)

    return {
        "score": round(score, 1),
        "semantic_similarity": round(semantic * 100, 1),
        "keyword_coverage": round(coverage * 100, 1),
        "matched_keywords": matched,
        "missing_keywords": missing,
        "structure": structure,
        "word_count": word_count,
        "scoring_method": method,
    }


def count_fillers(answer: str) -> tuple[int, list[str]]:
    text = " " + " ".join(tokenize(answer)) + " "
    found = {f: text.count(f" {f} ") for f in FILLERS}
    found = {f: n for f, n in found.items() if n}
    return sum(found.values()), sorted(found, key=lambda f: -found[f])


def score_delivery(answer: str, speaking_seconds: float) -> dict:
    words = len(tokenize(answer))
    wpm = words / (speaking_seconds / 60)
    low, high = IDEAL_WPM
    if low <= wpm <= high:
        pace = 100.0
    elif wpm < low:
        pace = max(40.0, 100 - (low - wpm) * 1.5)
    else:
        pace = max(40.0, 100 - (wpm - high) * 1.5)

    fillers, filler_words = count_fillers(answer)
    filler_rate = fillers / max(words, 1) * 100  # fillers per 100 words
    filler_score = max(40.0, 100 - filler_rate * 8)

    if wpm < low:
        pace_feedback = f"Your pace was {wpm:.0f} words/min. Try speaking a little faster (aim for {low}-{high})."
    elif wpm > high:
        pace_feedback = f"Your pace was {wpm:.0f} words/min. Slow down slightly for clarity (aim for {low}-{high})."
    else:
        pace_feedback = f"Good speaking pace ({wpm:.0f} words/min)."

    return {
        "score": round(0.6 * pace + 0.4 * filler_score, 1),
        "words_per_minute": round(wpm, 1),
        "speaking_seconds": round(speaking_seconds, 1),
        "filler_count": fillers,
        "filler_words": filler_words,
        "pace_feedback": pace_feedback,
    }


def score_presentation(face_presence: float, facing_camera: float, frames: int) -> dict:
    tips = []
    if face_presence < 0.8:
        tips.append("Stay centred in the camera frame throughout your answer.")
    if facing_camera < 0.6:
        tips.append("Look toward the camera more often, as you would look at an interviewer.")
    return {
        "score": round(100 * (0.5 * face_presence + 0.5 * facing_camera), 1),
        "face_presence_ratio": round(face_presence, 3),
        "facing_camera_ratio": round(facing_camera, 3),
        "frames_analyzed": frames,
        "feedback": tips or ["Good camera presence: you stayed in frame and faced the camera."],
    }


def combine(scores: dict) -> float:
    """Weighted average of the components that are available."""
    available = {k: v for k, v in scores.items() if v is not None}
    total_weight = sum(WEIGHTS[k] for k in available)
    return round(sum(WEIGHTS[k] * v for k, v in available.items()) / total_weight, 1)


# ---------------------------------------------------------------------------
# Main entry points
# ---------------------------------------------------------------------------
def evaluate_answer(question: dict, answer: str, mode: str = "text",
                    speaking_seconds: Optional[float] = None,
                    face_presence_ratio: Optional[float] = None,
                    facing_camera_ratio: Optional[float] = None,
                    frames_analyzed: Optional[int] = None) -> dict:
    content = score_content(question, answer)

    delivery = None
    if mode == "voice" and speaking_seconds and speaking_seconds >= 5 and content["word_count"] > 0:
        delivery = score_delivery(answer, speaking_seconds)

    presentation = None
    if (frames_analyzed or 0) >= 10 and face_presence_ratio is not None and facing_camera_ratio is not None:
        presentation = score_presentation(face_presence_ratio, facing_camera_ratio, frames_analyzed)

    strengths, improvements = [], []
    if content["semantic_similarity"] >= 70:
        strengths.append("Your answer is relevant and close to what interviewers expect.")
    elif content["semantic_similarity"] < 40:
        improvements.append("Answer the question more directly - focus on what was actually asked.")
    if content["matched_keywords"]:
        strengths.append(f"You covered key concepts: {', '.join(content['matched_keywords'][:4])}.")
    if content["missing_keywords"]:
        improvements.append(f"Also mention: {', '.join(content['missing_keywords'][:3])}.")
    if content["word_count"] < 40:
        improvements.append("Your answer is short. Aim for about 60-200 words (1-2 minutes).")
    elif content["word_count"] > 250:
        improvements.append("Keep your answer focused - try to finish within about 2 minutes.")
    if content["structure"]:
        missing_parts = [p.title() for p in ("situation", "task", "action", "result") if not content["structure"][p]]
        if missing_parts:
            improvements.append(f"Use the STAR method - add the {', '.join(missing_parts)} part(s).")
        else:
            strengths.append("Clear STAR structure (Situation, Task, Action, Result).")
    if delivery:
        good_pace = IDEAL_WPM[0] <= delivery["words_per_minute"] <= IDEAL_WPM[1]
        (strengths if good_pace else improvements).append(delivery["pace_feedback"])
        if delivery["filler_count"] >= 3:
            improvements.append(f"Reduce filler words ({', '.join(delivery['filler_words'][:3])}). Pause briefly instead.")
    if presentation:
        target = strengths if presentation["score"] >= 75 else improvements
        target.extend(presentation["feedback"])

    return {
        "question_id": question["id"],
        "question": question["question"],
        "category": question["category"],
        "mode": mode,
        "overall_score": combine({"content": content["score"],
                                  "delivery": delivery["score"] if delivery else None,
                                  "presentation": presentation["score"] if presentation else None}),
        "content": content,
        "delivery": delivery,
        "presentation": presentation,
        "strengths": strengths,
        "improvements": improvements,
        "sample_answer": question["model_answer"],
        "disclaimer": ADVISORY_NOTE,
    }


def _avg(values: list) -> Optional[float]:
    values = [v for v in values if v is not None]
    return round(sum(values) / len(values), 1) if values else None


def readiness_band(score: float) -> str:
    if score >= 75:
        return "Interview-ready"
    if score >= 55:
        return "Almost ready - keep practising"
    return "Needs more practice"


def build_report(career_name: str, results: list[dict]) -> dict:
    """Summarise a practice session (list of evaluate_answer results)."""
    dims = {
        "content": _avg([r["content_score"] for r in results]),
        "delivery": _avg([r.get("delivery_score") for r in results]),
        "presentation": _avg([r.get("presentation_score") for r in results]),
    }
    overall = _avg([r["overall_score"] for r in results])
    categories = sorted({r["category"] for r in results})
    by_category = {c: _avg([r["overall_score"] for r in results if r["category"] == c]) for c in categories}

    # Most frequent improvement tips across questions (stable order).
    counts: dict = {}
    for r in results:
        for tip in r.get("improvements", []):
            counts[tip] = counts.get(tip, 0) + 1
    focus = sorted(counts, key=lambda t: -counts[t])[:3]

    scored = {k: v for k, v in dims.items() if v is not None}
    return {
        "career_name": career_name,
        "questions_answered": len(results),
        "overall_score": overall,
        "readiness_band": readiness_band(overall),
        "dimension_scores": dims,
        "category_scores": by_category,
        "strongest_area": max(scored, key=scored.get),
        "weakest_area": min(scored, key=scored.get),
        "focus_tips": focus,
        "disclaimer": ADVISORY_NOTE,
    }
