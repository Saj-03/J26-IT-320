"""HuggingFace DistilBERT emotion model (pre-trained on emotion data). Lazy-loaded."""
from functools import lru_cache

MODEL_NAME = "bhadresh-savani/distilbert-base-uncased-emotion"


@lru_cache
def _pipe():
    from transformers import pipeline
    return pipeline("text-classification", model=MODEL_NAME)


def emotion(text: str) -> str:
    try:
        return _pipe()(text[:512])[0]["label"]
    except Exception:
        return "unknown"   # model not downloaded yet - system still works
