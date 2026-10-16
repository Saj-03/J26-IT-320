import pytest
from app.components.burnout.llm.prompts import is_crisis, build_system_prompt, BASE


@pytest.mark.parametrize("msg", [
    "I want to kill myself", "i WANT to die.", "I don\u2019t want to live anymore",
    "thinking about suicide", "i wanna end my life!!", "I might hurt myself",
])
def test_crisis_detected(msg):
    assert is_crisis(msg)


@pytest.mark.parametrize("msg", ["do I have burnout?", "this deadline is killing me", "so tired today"])
def test_normal_messages_not_crisis(msg):
    assert not is_crisis(msg)


def test_prompt_forbids_diagnosis_and_grounds_context():
    assert "Never diagnose" in BASE
    p = build_system_prompt({"task_load": 9, "completion_rate": 0.5, "deviation": "about normal"})
    assert "task load 9" in p and build_system_prompt(None) == BASE


def test_new_crisis_phrases_and_shared_helplines():
    from app.components.burnout.llm import prompts
    for t in ["I just can't go on", "there is no point in living", "I don't want to be alive", "everyone is better off without me"]:
        assert prompts.is_crisis(t), t
    assert not prompts.is_crisis("This deadline is killing me but I'm fine")
    assert "1926" in prompts.CRISIS_REPLY and "1333" in prompts.CRISIS_REPLY
    assert {h["number"] for h in prompts.HELPLINES} >= {"1926", "1333"}



def test_offline_companion_responds_to_what_was_said_and_varies():
    from app.components.burnout.llm.chat_agent import offline_reply
    h = lambda *msgs: [{"role": "user" if i % 2 == 0 else "assistant", "content": m} for i, m in enumerate(msgs)]
    a = offline_reply(h("I have three exams and I cannot sleep"))
    b = offline_reply(h("I feel so lonely lately"))
    c = offline_reply(h("Today was actually great"))
    assert len({a, b, c}) == 3
    assert "exam" in a.lower() or "academic" in a.lower() or "sleep" in a.lower()
    again = offline_reply(h("exams are stressing me", "tell me more", "still the exams"))
    assert again != offline_reply(h("exams are stressing me"))          # question rotates through the conversation
    for r in (a, b, c, again):
        assert "diagnos" not in r.lower() and "disorder" not in r.lower()


def test_offline_generic_replies_vary_and_new_themes_match():
    from app.components.burnout.llm.chat_agent import offline_reply
    h = lambda m: [{"role": "user", "content": m}]
    assert "sorry" in offline_reply(h("I feel so empty and useless")).lower()
    assert len({offline_reply(h(m)) for m in ["hello there", "what", "ok then", "hmm yes"]}) >= 2     # no more single stuck reply


def test_openai_compatible_provider_request(monkeypatch):
    import asyncio
    from app.components.burnout.llm import chat_agent
    from app.core.config import settings
    seen = {}

    async def fake_post(url, headers, payload):
        seen.update(url=url, headers=headers, payload=payload)
        return {"choices": [{"message": {"content": "hi from llm"}}]}

    monkeypatch.setattr(chat_agent, "_post", fake_post)
    monkeypatch.setattr(settings, "LLM_API_KEY", "k"); monkeypatch.setattr(settings, "LLM_PROVIDER", "openai")
    monkeypatch.setattr(settings, "LLM_BASE_URL", "https://api.groq.com/openai/v1"); monkeypatch.setattr(settings, "LLM_MODEL", "m")
    out = asyncio.run(chat_agent.reply("SYS", [{"role": "user", "content": "hello"}]))
    assert out == "hi from llm" and seen["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert seen["headers"]["Authorization"] == "Bearer k" and seen["payload"]["messages"][0] == {"role": "system", "content": "SYS"}


def test_offline_handles_greetings_and_clarifying_questions():
    from app.components.burnout.llm.chat_agent import offline_reply
    h = lambda m: [{"role": "user", "content": m}]
    assert "how are you feeling" in offline_reply(h("Hi")).lower()
    assert "sorry it's been like that" in offline_reply(h("bad")).lower()
    assert "wasn't clear" in offline_reply(h("what do you mean?")).lower()
    assert "wasn't clear" in offline_reply(h("um is that all?")).lower()
    assert "no rush" in offline_reply(h("okay")).lower()
    assert "exam" in offline_reply(h("my exams are killing me")).lower() or "academic" in offline_reply(h("my exams are killing me")).lower()
