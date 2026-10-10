"""Tests for the optional LLM feedback enhancer. No real API is called: HTTP is mocked."""
import json
import os

import httpx

os.environ["ACRDS_USE_SBERT"] = "0"

from app.components.career.services import llm_feedback  # noqa: E402
from app.components.career.services.interview_evaluator import evaluate_answer  # noqa: E402
from app.components.career.services.interview_questions import get_question  # noqa: E402

QUESTION = get_question("se_1")
ANSWER = "The four principles are encapsulation, inheritance, polymorphism and abstraction."
RESULT = evaluate_answer(QUESTION, ANSWER)
GOOD = {"strengths": ["Named all four principles"], "improvements": ["Add an example for each"],
        "suggested_answer": "The four principles are ...", "final_tip": "Always give one example."}


def mock_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def config(provider):
    return {"provider": provider, "api_key": "test-key", "model": "test-model"}


def test_disabled_without_provider_or_key(monkeypatch, tmp_path):
    for name in ("LLM_PROVIDER", "GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "LLM_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(llm_feedback, "ENV_FILE", tmp_path / ".env")  # no file
    llm_feedback.load_config.cache_clear()
    assert llm_feedback.load_config() is None
    assert llm_feedback.llm_status() == {"enabled": False}
    assert llm_feedback.generate_llm_feedback(QUESTION, ANSWER, RESULT) is None

    monkeypatch.setenv("LLM_PROVIDER", "gemini")  # provider chosen but no key -> still off
    llm_feedback.load_config.cache_clear()
    assert llm_feedback.load_config() is None
    llm_feedback.load_config.cache_clear()


def test_config_from_env_file_and_shared_model_guard(monkeypatch, tmp_path):
    for name in ("LLM_PROVIDER", "GEMINI_API_KEY", "LLM_MODEL", "CAREER_LLM_MODEL"):
        monkeypatch.delenv(name, raising=False)
    env = tmp_path / ".env"
    # LLM_MODEL belongs to another provider (the team's Claude setting) -> must not be sent to Gemini
    env.write_text("LLM_PROVIDER=Gemini\nGEMINI_API_KEY=abc\nLLM_MODEL=claude-sonnet-4-6\n", encoding="utf-8")
    monkeypatch.setattr(llm_feedback, "ENV_FILE", env)
    llm_feedback.load_config.cache_clear()
    cfg = llm_feedback.load_config()
    assert cfg == {"provider": "gemini", "api_key": "abc", "model": "gemini-3.5-flash-lite"}
    assert "api_key" not in llm_feedback.llm_status()  # the key is never exposed
    llm_feedback.load_config.cache_clear()


def test_each_provider_request_and_reply():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen[request.url.host] = (dict(request.headers), body)
        text = json.dumps(GOOD)
        if "googleapis" in request.url.host:
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})
        if "openai" in request.url.host:
            return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})
        return httpx.Response(200, json={"stop_reason": "end_turn",
                                         "content": [{"type": "thinking", "thinking": ""}, {"type": "text", "text": text}]})

    for provider in ("gemini", "openai", "claude"):
        out = llm_feedback.generate_llm_feedback(QUESTION, ANSWER, RESULT, config(provider), mock_client(handler))
        assert out["strengths"] == GOOD["strengths"] and out["provider"] == provider

    assert seen["generativelanguage.googleapis.com"][0]["x-goog-api-key"] == "test-key"
    assert seen["api.openai.com"][0]["authorization"] == "Bearer test-key"
    claude_headers, claude_body = seen["api.anthropic.com"]
    assert claude_headers["x-api-key"] == "test-key"
    assert claude_body["output_config"]["format"]["type"] == "json_schema"
    assert "temperature" not in claude_body  # current Claude models reject sampling parameters
    # The prompt carries the answer and the safety rules, but no student identity.
    assert ANSWER in claude_body["messages"][0]["content"]
    assert "hiring decision" in claude_body["system"] and "personality" in claude_body["system"]


def test_failures_fall_back_to_rule_based():
    cases = [
        lambda r: httpx.Response(500, json={"error": "boom"}),                       # provider error
        lambda r: httpx.Response(401, json={"error": "bad key"}),                    # wrong key
        lambda r: httpx.Response(200, json={"choices": [{"message": {"content": "not json"}}]}),  # bad reply
        lambda r: httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]}),        # empty JSON
    ]
    for handler in cases:
        assert llm_feedback.generate_llm_feedback(QUESTION, ANSWER, RESULT, config("openai"), mock_client(handler)) is None

    def timeout(request):
        raise httpx.ConnectTimeout("slow", request=request)
    assert llm_feedback.generate_llm_feedback(QUESTION, ANSWER, RESULT, config("gemini"), mock_client(timeout)) is None

    refusal = lambda r: httpx.Response(200, json={"stop_reason": "refusal", "content": []})  # noqa: E731
    assert llm_feedback.generate_llm_feedback(QUESTION, ANSWER, RESULT, config("claude"), mock_client(refusal)) is None


def test_parse_feedback_tolerates_code_fences_and_trims():
    fenced = "```json\n" + json.dumps({**GOOD, "strengths": ["a", "b", "c", "d", "e", "f"]}) + "\n```"
    parsed = llm_feedback.parse_feedback(fenced)
    assert parsed["strengths"] == ["a", "b", "c", "d"]
    assert llm_feedback.parse_feedback("[1, 2]") is None
