"""
M4 v2 inside the app: where does each new item start in a spoken day? (token level)

    "office at 8 then eat 8 to 9 and study i have urgent exam tomorrow"
      -> ["office at 8", "then eat 8 to 9", "and study", "i have urgent exam tomorrow"]

Uses ml_models/m4v2_segmenter.joblib (logistic regression) or ml_models/m4v2_segmenter/ (MiniLM),
made by ml_training/scheduler/train_m4v2.py. No model -> None, and the app keeps its rules.
"""
import json
from functools import lru_cache

from app.components.scheduler.ml import MODELS_DIR

JOBLIB_FILE = MODELS_DIR / "m4v2_segmenter.joblib"
MINILM_DIR = MODELS_DIR / "m4v2_segmenter"


@lru_cache(maxsize=1)
def _load():
    try:
        if JOBLIB_FILE.exists():
            import joblib
            return joblib.load(JOBLIB_FILE)
        if (MINILM_DIR / "config.json").exists():
            from transformers import AutoModelForTokenClassification, AutoTokenizer
            # low_cpu_mem_usage=False: the fast loader briefly switches torch to an empty "meta" device for the
            # WHOLE process, which broke an M1 model being built at the same moment in another request
            model = AutoModelForTokenClassification.from_pretrained(MINILM_DIR, low_cpu_mem_usage=False).float().eval()
            threshold = json.loads((MINILM_DIR / "threshold.json").read_text())["threshold"]
            return {"kind": "minilm", "tok": AutoTokenizer.from_pretrained(MINILM_DIR), "model": model,
                    "threshold": threshold}
    except Exception:                                    # no file / no library / old file -> rules
        return None
    return None


def available() -> bool:
    return _load() is not None


def item_starts(words: list[str]) -> list[int] | None:
    """Positions (word index > 0) where a new item starts, or None when the model is not available."""
    saved = _load()
    if saved is None or not words:
        return None
    if saved["kind"] == "logreg":
        from ml_training.scheduler.train_m4v2 import features
        X = saved["vec"].transform([features(words, i) for i in range(len(words))])
        probs = saved["clf"].predict_proba(X)[:, 1]
    else:
        import torch
        enc = saved["tok"]([words], is_split_into_words=True, truncation=True, max_length=128, return_tensors="pt")
        with torch.no_grad():
            p = torch.softmax(saved["model"](**enc).logits, -1)[0, :, 1].numpy()
        probs, seen = [0.0] * len(words), set()
        for j, wid in enumerate(enc.word_ids(0)):
            if wid is not None and wid not in seen:
                probs[wid] = float(p[j])
                seen.add(wid)
    return [i for i, x in enumerate(probs) if i > 0 and x >= saved["threshold"]]

