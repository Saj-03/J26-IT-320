# Component 3 – Attention-Aware & Stress-Responsive Gamified Scheduler

Owner: C.S.K.A.I.A. Kumara (IT23270206) · Project J26-IT-320 · All endpoints are under `/api/scheduler`.

This file is the **map**: for every requirement in the proposal it shows the endpoint, the code and the test.
In VS Code press **Ctrl+P** and type a file name to open it.

## Folders

| Folder | What is inside | Proposal |
|---|---|---|
| `router.py` | every HTTP endpoint (thin: read request → call a service → return) | – |
| `models.py` · `schemas.py` | database tables · request/response formats | – |
| `settings_service.py` | per-student settings (study hours, daily cap, mode, opt-outs) | ethics, pilot |
| `tasks/` | tasks, subtasks, commitments (busy time), free time, clashes | FR-01, FR-02 |
| `planning/` | **Plan my week**: CP-SAT constraint scheduler + planner service, missed-session recovery | Module D, FR-04, FR-09, FR-14 |
| `focus/` | focus sessions, adaptive timer, M1 attention profile, focus-decline alert | FR-05, FR-13, FR-15, FR-16 |
| `stress/` | Component 4 risk signal → safety check → proposal → accept / edit / reject / undo | Module F, FR-06, FR-07, FR-08 |
| `rewards/` | XP, streaks, badges, milestones, insights, notifications | FR-10, FR-11 |
| `voice/` | "Speak your day": one paragraph → M4 + slot rules → editable cards → save | extension |
| `research/` | researcher modes (static / adaptive / attention-only), CSV export, 1–5 ratings | FR-12, pilot |
| `ml/` | loaders for the four trained models (M1–M4); files live in `backend/ml_models/` | Objectives 1–2 |

`task_service.py` and `commitment_service.py` at the top level are **only aliases** to `tasks/` (other
components and branches still import the old paths). They contain no code.

## Requirement map

| ID | Requirement (short) | Endpoint(s) | Code | Test |
|---|---|---|---|---|
| FR-01 | create / edit / delete tasks | `POST/GET/PATCH/DELETE /tasks` | `tasks/task_service.py` | `test_scheduler_tasks.py` |
| FR-02 | fixed commitments + study periods | `/commitments`, `GET /availability`, `GET /conflicts` | `tasks/commitment_service.py` | `test_scheduler_commitments.py` |
| FR-03 | split a large task into steps sized to attention + load tag | `GET/POST /tasks/{id}/suggested-steps` | `planning/planner_service.py` → `suggest_steps` · load: `ml/m2_classifier.py` | `test_scheduler_plan.py`, `test_scheduler_m2_app.py` |
| FR-04 | feasible schedule (deadline, priority, duration, availability, **dependencies**: "do B after A", steps in order) | `POST /plan`, `GET /plan`, `after_task_id` on tasks | `planning/cp_scheduler.py` → `schedule` · `planning/planner_service.py` → `build_plan`, `task_order` | `test_scheduler_cp.py`, `test_scheduler_plan.py`, `test_scheduler_dependencies.py` |
| FR-05 | record focus sessions (start, pause, end, misses, rating) | `/focus/start`, `/focus/{id}/pause\|resume\|end\|rating` | `focus/focus_service.py` | `test_scheduler_focus_*.py` |
| FR-06 | receive + validate the C4 risk payload (stale / malformed rejected) | `POST /api/integration/risk-signal` (shared) · `GET /stress/status` | `app/shared/integration/validator.py` · `stress/stress_service.py` → `stress_status` | `test_c4_c3_contract.py`, `test_scheduler_stress_status.py` |
| FR-07 | elevated risk → protect urgent work, propose move / split / rest | `GET /stress/proposals` (made by itself), `POST /stress/propose` | `stress/stress_service.py` → `task_safety`, `build_changes`, `auto_propose` | `test_scheduler_stress_safety.py`, `test_scheduler_stress_propose.py` |
| FR-08 | explain every change; accept / edit / reject / restore | `POST /stress/proposals/{id}/decision`, `/restore` | `stress/stress_service.py` → `decide`, `restore` | `test_scheduler_stress_decision.py` |
| FR-09 | missed session → feasible recovery plan | `GET /plan/recovery` | `planning/planner_service.py` → `missed_pieces`, `recovery_preview` | `test_scheduler_plan.py` |
| FR-10 | XP, streaks, badges, milestones (once per event) | `GET /progress`, `POST /tasks/{id}/complete` | `rewards/gamification.py`, `rewards/progress_service.py` | `test_scheduler_progress.py` |
| FR-11 | show schedule, progress, deadlines, risk changes, rewards | `GET /notifications`, `GET /insights` (+ frontend pages) | `rewards/notification_service.py`, `rewards/insights_service.py` | `test_scheduler_notifications.py`, `test_scheduler_insights.py` |
| FR-12 | pseudonymous pilot export | `GET /research/export.csv` | `research/research_export.py` | `test_scheduler_research_export.py`, `test_scheduler_research_engagement.py` |
| 3.2.2 | a student can leave the study and have their research data deleted | `POST /research/me/withdraw` | `research/research_service.py` → `withdraw` | `test_scheduler_research_withdraw.py` |
| FR-13 | attention capacity + peak / low windows after a minimum history | `GET /attention/profile` | `focus/attention_service.py` · `ml/m1_predictor.py` | `test_scheduler_attention.py`, `test_scheduler_m1.py` |
| FR-14 | heavy work in peak windows, light work in low windows | `POST /plan` | `planning/planner_service.py` → `attention_fit` | `test_scheduler_plan.py` |
| FR-15 | adaptive Pomodoro focus / break with manual override | `GET /focus/recommendation` | `focus/focus_service.py` → `recommend_timer` | `test_scheduler_focus_start.py` |
| FR-16 | alert on a sustained focus decline (no diagnosis) | `GET /focus/alert`, `POST /focus/alert/dismiss` | `focus/alert_service.py` | `test_scheduler_focus_alert.py` |

The whole student journey (all of the above working together) is in `tests/test_c3_journey.py`.

## Machine-learning models

| Model | What it predicts | App code | Training (`backend/ml_training/scheduler/`) | Results |
|---|---|---|---|---|
| M1 | focus-session success by hour (GRU + attention) → peak hours, timer | `ml/m1_predictor.py` | `train_m1.py` | `data/m1_results.json` |
| M2 | task cognitive load (heavy / medium / light) | `ml/m2_classifier.py` | `train_m2.py` | `data/m2_results.json` |
| M3 | real task duration from the student's past over-runs | `ml/m3_predictor.py` | `train_m3.py` | `data/m3_results.json` |
| M4 | what each piece of a spoken day is (task, commitment, energy …) | `ml/m4_predictor.py` | `train_m4.py`, `m4_speech_eval.py` | `data/m4_results.json`, `data/m4_speech_results.json` |
| M4 v2 | where each new item starts in a spoken day (MiniLM, token level) | `ml/m4v2_segmenter.py` | `m4v2_dataset.py`, `train_m4v2.py`, `try_m4v2.py` | `data/m4v2_results.json` |

If a model file is missing the app falls back to simple rules; `tests/test_ml_model_files.py` makes sure
that never happens silently.

## Non-functional requirements

| ID | How it is met | Where |
|---|---|---|
| NFR-01 | plan in < 2 s (CP-SAT time limit 1.2 s; latency logged per plan) | `planning/cp_scheduler.py`, audit `plan_generated` |
| NFR-02 | XP and rewards keyed by event id (no duplicates); one proposal per signal (database lock) | `rewards/progress_service.py`, `stress/stress_service.py` → `auto_propose` |
| NFR-03 | no / stale C4 signal → normal schedule | `stress/stress_service.py` → `stress_status` |
| NFR-05 | export uses research ids only | `research/research_export.py` |
| NFR-08 | every proposal shows the reason, task, old slot → new slot | `stress/stress_service.py` → `build_changes` |
| NFR-09 | scheduling, stress rules, gamification and integration are separate, testable modules | this folder layout |
| NFR-10 | every plan, risk update, proposal and decision is audited | `SchedulerAuditLog` (`models.py`) |
| NFR-12 | "not a clinical diagnosis" + support message on the stress page | frontend `StressAdjust.jsx` |

## Two request flows

**Plan my week** – `router.build_plan` → `planning/planner_service.build_plan` → open tasks + free time
(`tasks/commitment_service`) + M1 fit (`focus/attention_service`) + M3 durations (`ml/m3_predictor`) →
`planning/cp_scheduler.schedule` → saved as `PlannedSession` rows. The plan then changes by itself when a
task, commitment or accepted stress proposal changes (`planner_service.auto_replan`).

**Component 4 signal** – C4 writes a `RiskSignal` row (shared table) → the app checks in (notifications every
2 min) → `stress/stress_service.auto_propose` → safety check (`task_safety`) → proposal waits for the
student → accept → changes applied → `auto_replan`. Undo with `restore`.

## Run the tests

```
cd backend
.venv\Scripts\python -m pytest -q
```
