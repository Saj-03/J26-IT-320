"""M4 classifier: dataset rules, keyword baseline and the trained model on everyday sentences."""
import pytest

from ml_training.scheduler import m4_dataset as D
from ml_training.scheduler import train_m4 as T


def test_massive_intents_map_to_our_labels():
    assert D.massive_label({"intent": "alarm_set", "utt": "wake me up at 6"}) == "routine"
    assert D.massive_label({"intent": "lists_createoradd", "utt": "add milk to my list"}) == "task_personal"
    assert D.massive_label({"intent": "calendar_set", "utt": "meeting with peter at 2"}) == "commitment"
    assert D.massive_label({"intent": "calendar_set", "utt": "remind me to call mum"}) == "task_personal"
    assert D.massive_label({"intent": "weather_query", "utt": "will it rain"}) == "other"


def test_templates_fill_without_leftover_brackets():
    import random
    rng = random.Random(0)
    for parts in D.TEMPLATES.values():
        for t in parts["train"] + (parts["test"] or []):
            assert "{" not in D.fill(t, rng)


def test_keyword_baseline():
    assert T.keyword_rules(["plan my day", "I'm so tired", "finish the DBMS assignment", "what time is it"]) == \
        ["plan_request", "energy", "task_academic", "other"]


def test_trained_model_reads_everyday_sentences():
    import joblib
    try:
        bundle = joblib.load(T.MODEL_OUT)
    except FileNotFoundError:
        pytest.skip("M4 model not trained (run train_m4)")
    model = bundle["tfidf"]
    said = {"finish the machine learning report by friday": "task_academic",
            "add eggs and bread to my shopping list": "task_personal",
            "wake me up at six tomorrow": "routine",
            "I'm really exhausted today": "energy",
            "what's the weather like": "other"}
    got = dict(zip(said, model.predict(list(said))))
    assert sum(got[k] == v for k, v in said.items()) >= 4, got
