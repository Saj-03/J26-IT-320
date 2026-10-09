"""
Interview feedback = content (SBERT) + voice + facial presence.
Raw audio/video is NEVER stored (NFR-05) - browser sends only numbers.
"""
from functools import lru_cache


@lru_cache
def _model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


def content_score(answer: str, reference: str) -> float:
    from sentence_transformers import util
    m = _model()
    return round(float(util.cos_sim(m.encode(answer), m.encode(reference))), 3)


def voice_feedback(wpm: float | None, fillers: int | None) -> str:
    if wpm is None:
        return "No voice data."
    if wpm < 110:
        return "Try speaking a little faster."
    if wpm > 170:
        return "Slow down slightly for clarity."
    return "Good speaking pace." + (" Reduce filler words." if (fillers or 0) > 5 else "")


def face_feedback(eye_contact: float | None) -> str:
    if eye_contact is None:
        return "No camera data."
    return "Good eye contact." if eye_contact >= 0.6 else "Look at the camera more often."
