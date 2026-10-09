# Viva Guide — how to explain this codebase

## 1. The one-sentence architecture
"React frontend talks to one FastAPI backend over REST with JWT auth. The backend has four independent
component modules and one shared integration layer, all on one PostgreSQL database."

```
React (features/*)  ──REST+JWT──►  FastAPI  ──►  components/{career, physical_wellbeing, scheduler, burnout}
                                     │                 ▲             │
                                     └── shared/integration (versioned JSON contracts + audit log)
                                                       │
                                                  PostgreSQL
```

## 2. The layering rule inside every component (say this!)
```
router.py   -> HTTP only: receives request, returns response
schemas.py  -> Pydantic: validates input/output shape
service.py  -> business logic
models.py   -> SQLAlchemy tables
ml/ engine/ nlp/ llm/ -> the research algorithms (pure Python, unit-testable)
```
"Because the algorithm files don't know about HTTP or the database, I can unit-test them directly —
see `backend/tests/`."

## 3. Where each research idea lives

**Career — ACRDS (IT23207240)**
- Top-5 careers, cosine similarity → `career/ml/recommender.py`
- Skill-gap → `career/ml/skill_gap.py`; roadmap → `career/ml/roadmap.py`
- Interview feedback (SBERT + voice + face) → `career/ml/interview_eval.py`
- Career data (extend without changing algorithm, NFR-08) → `datasets/career/careers.json`

**Physical Wellbeing (IT23316522)**
- Rule filter + XGBoost adherence ranking → `physical_wellbeing/ml/recommender.py`
- Model training → `ml_training/physical_wellbeing/train_adherence_xgb.py`
- Sri Lankan + international meals → `datasets/physical/meals.json`
- Streaks & badges → `physical_wellbeing/service.py`
- Webcam pose (browser-only, no storage) → `frontend/.../components/PoseCoach.jsx`
- Recovery mode switched on by C4 signal → `WellbeingProfile.recovery_mode`

**C3 Adaptive Scheduler (IT23270206)** — three pillars
- Pillar 1 constraint scheduling + static baseline → `scheduler/engine/constraint_scheduler.py`
- Pillar 2 attention capacity, peak windows, adaptive Pomodoro → `scheduler/engine/attention_model.py`
- Pillar 3 stress-responsive rules (urgent tasks protected, proposal only) → `scheduler/engine/stress_rules.py`
- Gamification (idempotent XP) → `scheduler/engine/gamification.py`
- Static vs adaptive experiment switch → `GET /api/scheduler/plan?adaptive=false`
- Student override logged → `ScheduleChange.decision`

**C4 Burnout Prediction & Nudging (IT23201378)**
- Passive deviation, Isolation Forest → `burnout/ml/deviation_detector.py`
- VADER sentiment → `burnout/nlp/sentiment.py`; DistilBERT emotion → `burnout/nlp/emotion.py`
- Multi-signal fusion (novel contribution) → `burnout/ml/fusion.py`
- Context-grounded LLM agent + non-diagnostic prompt → `burnout/llm/`
- Baseline 2 (no context) → `ChatIn.context_grounded = false`

## 4. Integration (examiners always ask this)
All contracts are in `backend/app/shared/integration/contracts.py`:

| From → To | Contract |
|---|---|
| C4 → C3, Physical | `RiskSignal` (risk_score 0–1, risk_level, trend, timestamp, schema_version) |
| C3 → C4 | `DeviationSignal` (completion rate, missed sessions, deadline density) |
| C4 → Physical | `RecoverySignal` |
| Career → C3 | `RoadmapActivity` (student must approve) |
| Physical → C3 | `ProtectedBlock` |

Safety checks (`validator.py`): schema version, duplicate `event_id` rejected, stale signal ignored
→ scheduler falls back to normal mode. Every message saved in `signal_events` table (audit trail).
Before live integration, members used `mock_signals.py`.

## 5. Likely viva questions — short answers
- **Why FastAPI?** Python is needed for ML; FastAPI gives async, automatic validation and `/docs`.
- **Why one database?** Shared student identity; but components only exchange data via contracts, never each other's tables.
- **How is privacy handled?** Pseudonymous `research_id`, JWT auth, no raw audio/video stored, webcam processed in browser.
- **How do you evaluate?** `ml_training/` scripts + `tests/`; C3 compares `adaptive=true` vs `false`.
- **What if another component is down?** Stale/missing signal → safe fallback, fault logged.
- **Why is the chatbot safe?** Supervisor-reviewed non-diagnostic system prompt in `llm/prompts.py`.
