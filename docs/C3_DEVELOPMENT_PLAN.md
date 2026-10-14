# C3 — Attention-Aware & Stress-Responsive Gamified Scheduler
## Full development plan (C.S.K.A.I.A. Kumara — IT23270206)

Goal: build the whole component from scratch, with real ML / DL / neural-network models,
each with a **clear job, a baseline to beat, and a metric** (this is what the viva will test).

---

## 0. The big picture

```
 Student adds task ─► [M2 Load Classifier] ─► [LLM Decomposer] ─► subtasks
                                                     │
                                                     ▼
                      [M3 Duration Predictor] ─► predicted minutes (+ range)
                                                     │
 Focus-session logs ─► [M1 Focus Success Network] ─► success map (hour × weekday × length)
                              │                       ├─ attention capacity
                              │                       ├─ peak / low windows
                              │                       └─ adaptive Pomodoro
                              ▼
                      [CP-SAT Optimizer]  ◄── commitments, deadlines, protected blocks
                              │
                              ▼
                         Weekly plan ─► [M4 Deadline-Risk Predictor] ─► early re-plan
                              │
 C4 wellbeing signal ─► [Safety Rules] ─► allowed changes ─► [M5 Acceptance Model] ─► ranked proposal
                              │                                                          │
                              ▼                                                          ▼
                      Gamification (XP, streaks, badges)         Student: accept / edit / reject / restore
                              │
                              └──► every event logged ─► models retrain offline
```

Two experiment modes run on the **same app**:
- `static`   = EDF scheduler, fixed 25-min Pomodoro, no C4 signal (baseline)
- `adaptive` = all models + stress layer
- `attention_only` = models but ignore C4 (ablation, if data allows)

---

## 1. Modules and functions

### Module A — Tasks & commitments (FR-01, FR-02)
| Function | Purpose |
|---|---|
| `create_task(user, data)` / `update_task` / `delete_task` | CRUD with title, description, deadline, priority, estimate, fixed/flexible |
| `add_commitment(user, data)` | lectures, work hours, unavailable blocks (recurring weekly) |
| `get_availability(user, start, end) -> list[Slot]` | free time = window − commitments − protected blocks |
| `detect_conflicts(user)` | overlapping commitments / impossible deadlines |

### Module B — Task intelligence (FR-03)
| Function | Model | Purpose |
|---|---|---|
| `classify_load(title, description) -> (label, confidence)` | **M2** | heavy / medium / light |
| `decompose_task(task, capacity) -> list[Subtask]` | LLM + M2 | split big task into steps sized to the student's capacity; student can edit |
| `predict_duration(user, task) -> (p50, p10, p90)` | **M3** | realistic minutes with uncertainty range |

### Module C — Attention learning (FR-05, FR-13, FR-15, FR-16)
| Function | Model | Purpose |
|---|---|---|
| `start_session` / `pause_session` / `end_session(rating?)` | — | log every focus event |
| `success_probability(user, hour, weekday, minutes, load) -> float` | **M1** | core prediction |
| `success_map(user) -> grid[7][24]` | M1 | heatmap shown on dashboard |
| `attention_capacity(user, load) -> minutes` | M1 | longest length with P(success) ≥ 0.7 |
| `peak_windows(user)` / `low_windows(user)` | M1 | top / bottom hours |
| `recommend_pomodoro(user, load) -> {focus, break}` | M1 | adaptive timer; user can override (logged) |
| `detect_attention_decline(user) -> Alert?` | CUSUM on M1 residuals | non-diagnostic "your focus pattern changed" alert |
| `has_enough_history(user) -> bool` | — | below minimum → fallback to survey answers |

### Module D — Scheduling (FR-04, FR-14)
| Function | Purpose |
|---|---|
| `build_plan(user, mode)` | entry point, picks static or adaptive |
| `static_plan(tasks, slots)` | **baseline** — EDF + priority (current code) |
| `optimize_plan(tasks, slots, success_map, durations)` | **OR-Tools CP-SAT**: hard = deadlines, commitments, no overlap, daily cap; objective = maximise Σ P(success) for heavy tasks + minimise changes vs previous plan (stability) |
| `reverse_plan(task)` | work backwards from deadline into sessions |
| `explain_placement(task, slot) -> str` | "Placed at 9am — your strongest focus window" |

### Module E — Risk & recovery (FR-09)
| Function | Model | Purpose |
|---|---|---|
| `deadline_risk(user, task) -> prob` | **M4** | chance this task misses its deadline |
| `on_session_missed(session)` | — | recompute remaining capacity, propose recovery plan, no duplicates |
| `proactive_replan(user)` | M4 | if risk > threshold, propose an earlier/longer slot |

### Module F — Stress-responsive adaptation (FR-06, FR-07, FR-08)
| Function | Model | Purpose |
|---|---|---|
| `receive_wellbeing_signal(payload)` | — | validate schema, freshness, duplicate event_id, store tier only |
| `allowed_actions(tasks, severity)` | rules | **safety layer**: never touch urgent tasks; only future, flexible work |
| `generate_candidates(tasks, severity)` | rules | defer / split / lighten / insert recovery block |
| `rank_changes(user, candidates)` | **M5** | order by predicted acceptance |
| `propose_changes(user)` | — | build change set + plain-language reason |
| `apply_decision(change_id, accept/edit/reject)` / `restore(change_id)` | — | full audit trail |
| `fallback_if_stale()` | — | no signal → normal plan, fault logged, nothing moved |

### Module G — Gamification (FR-10)
| Function | Purpose |
|---|---|
| `award_xp(event)` | idempotent (event id = key), XP by load & session completion |
| `update_streak(user)` | daily focus streak, with 1 "freeze" per week (no punishment during high stress) |
| `check_badges(user)` / `check_milestones(user)` | e.g. "5 heavy tasks in peak window", "first week complete" |
| `level(user)` | from total XP |

### Module H — Integration
| Direction | Contract | Function |
|---|---|---|
| C4 → C3 | `WellbeingSignal` (severity tier, source: fusion / mood_button, request_type) | `receive_wellbeing_signal` |
| C3 → C4 | `WeeklySummary` (completion, missed, load, deadline density, semester phase) | `send_weekly_summary` |
| Career → C3 | `RoadmapActivity` (student must approve) | `import_roadmap_activity` |
| Physical → C3 | `ProtectedBlock` | `add_protected_block` |
| C3 → Physical | `AvailabilitySummary` (free time, exam period flag) | `send_availability` |

### Module I — Research & evaluation (FR-12, NFR-10)
| Function | Purpose |
|---|---|
| `set_mode(user, static/adaptive/attention_only)` | counterbalanced AB/BA assignment |
| `audit(event)` | every plan, signal, proposal, decision |
| `export_metrics(period) -> CSV` | pseudonymous: completion, adherence, stability, overrides, focus, model errors, latency |
| `compute_stability(user, week)` | changed minutes + reschedule count |

---

## 2. The ML / DL models in detail

### M1 — Focus Success Network (DEEP LEARNING, main contribution)
- **Question:** "If this student starts an N-minute session at this time on this kind of task, will they finish it?"
- **Input:**
  - current context: hour (sin/cos), weekday (one-hot), planned minutes, task load, days to deadline, sessions already done today
  - history: last 10 sessions as a sequence `[hour, minutes_planned, minutes_actual, completed, pauses, load, rating]`
  - student embedding (16-dim, learned)
- **Architecture (PyTorch):** history → **GRU (64)** → concat with context + user embedding → **MLP (64→32→1, sigmoid)**
- **Output:** P(success). Sweep hours × lengths → success map → capacity, peaks, Pomodoro.
- **Cold start:** new student = population model + survey answers ("most productive time", "how long can you focus").
- **Baseline:** current rules (median duration, completion-rate per hour).
- **Metrics:** AUC, Brier score, capacity MAE vs actually sustained minutes, peak-window overlap week-to-week.
- **Files:** `ml/focus_net.py`, `ml_training/scheduler/train_focus_net.py`, `ml_models/scheduler/focus_net.pt`

### M2 — Cognitive Load Classifier (DEEP LEARNING / NLP)
- **Input:** task title + description text.
- **Model:** fine-tuned **DistilBERT** (3 classes). Lighter option: SBERT embeddings → small MLP.
- **Data:** ~1,500 labelled task titles (survey + generated + manually labelled; 2 labellers, report Cohen's kappa).
- **Baseline:** keyword rules ("exam", "report", "code" → heavy; "read", "email" → light).
- **Metric:** macro-F1, confusion matrix. Student can relabel → becomes new training data.

### M3 — Duration Predictor (MACHINE LEARNING)
- **Input:** student estimate, load, task type, word count, student's past estimate-error ratio, time to deadline.
- **Model:** **XGBoost quantile regression** (p10, p50, p90).
- **Baseline:** student's own estimate. **Metric:** MAE, % actuals inside p10–p90.

### M4 — Deadline-Risk Predictor (MACHINE LEARNING)
- **Input:** remaining minutes vs free minutes before deadline, % subtasks done, recent missed sessions, M1 success for planned slots.
- **Model:** **XGBoost classifier** (+ SHAP for explanations).
- **Baseline:** "less than X days and less than Y% done" rule. **Metric:** ROC-AUC, recall at fixed precision.

### M5 — Change-Acceptance Model (MACHINE LEARNING → bandit)
- **Input:** change type, severity tier, task load/priority, time of day, student's past accept rate.
- **Model:** logistic regression first; upgrade to **contextual bandit (LinUCB)** once decisions accumulate.
- **Baseline:** fixed rule order. **Metric:** acceptance rate, regret.

### Not ML on purpose (say this in the viva)
- **Safety rules** — must be predictable and auditable; ML only *ranks* what the rules allow.
- **CP-SAT optimizer** — exact constraints; ML supplies the objective weights.
- **Gamification** — simple and transparent.

---

## 3. Data plan
1. **Synthetic student simulator** (`ml_training/scheduler/simulate_students.py`): 500 students with hidden
   peak hours, capacity, estimation bias, fatigue, stress weeks → generates tasks + sessions.
   Use it to train first versions and **prove M1 recovers the hidden profile** (great viva demo).
2. **Public data:** StudentLife (activity/deadline patterns) for M1/M4 pre-training checks.
3. **Unified survey (your scheduler section):** cold-start priors + task titles for M2.
4. **Pilot data:** retrain all models; evaluate with rolling-origin validation (train earlier weeks, test later).

---

## 4. Database tables
`tasks` (+ description, task_type, flexible, parent_id, predicted_minutes, load_confidence) ·
`commitments` · `focus_sessions` (+ pauses, rating, load, mode) · `attention_profiles` (cached map, model version) ·
`plans` / `plan_items` (for stability) · `wellbeing_signals` (tier only) · `schedule_changes` (+ restored_at, edited payload) ·
`reward_events` · `user_settings` (mode, timer override, opt-outs) · `audit_log` · `model_predictions` (for error metrics)

## 5. API endpoints (`/api/scheduler`)
`tasks` CRUD · `tasks/{id}/decompose` · `commitments` CRUD · `plan?mode=` · `focus/start|pause|end` ·
`attention/profile` · `attention/pomodoro` · `changes` (list) · `changes/{id}/decision` · `changes/{id}/restore` ·
`rewards` · `alerts` · `admin/export` · integration endpoints under `/api/integration`

## 6. Frontend screens
Weekly plan (with "why here?" tooltips) · Add task + subtask editor · Focus timer (adaptive Pomodoro) ·
Attention heatmap (7×24) · Change proposals (accept/edit/reject/restore) · Rewards & streaks · Settings/consent

---

## 7. Build order
| Step | Build | Done when |
|---|---|---|
| 1 | DB tables + migrations, task/commitment CRUD, availability | API tests pass |
| 2 | Focus-session logging + audit log + mode switch | sessions recorded for both modes |
| 3 | Synthetic simulator | 500 students generated, hidden profiles saved |
| 4 | Static baseline scheduler (keep current EDF) + stability metric | baseline plan works |
| 5 | **M1 Focus Success Network** train + evaluate vs rules | beats baseline AUC on simulated data |
| 6 | Capacity / peaks / Pomodoro / decline alert from M1 | profile endpoint live |
| 7 | M3 Duration + M4 Deadline-risk | beat student-estimate / rule baselines |
| 8 | M2 Load classifier + LLM decomposer | macro-F1 reported, subtasks editable |
| 9 | CP-SAT optimizer using M1/M3 | p95 < 2 s, all hard constraints pass |
| 10 | Stress layer: signal intake, safety rules, M5 ranking, decisions, restore | rule-case tests pass |
| 11 | Gamification + integration contracts | idempotency tests pass |
| 12 | Frontend screens + metrics export | end-to-end demo |

---

## 8. Also needed (supporting parts, not research models)
| Part | Why |
|---|---|
| **Smart reminders / notifications** | TAF promises "smart reminders"; nudge before a planned session, after a miss |
| **Calendar import (.ics / Google Calendar)** | students won't retype lectures; fills `commitments` automatically |
| **In-app pilot questionnaires** | pre / weekly / post items from proposal Table A1 + SUS, stored with the logs |
| **Consent & opt-out screens** | ethics: consent, disable focus tracking, delete my research data |
| **Researcher dashboard** | see mode assignment (AB/BA), participation, data quality during the pilot |
| **Model retraining pipeline** | weekly retrain job, model version saved with every prediction |
| **Explainability** | SHAP for M3/M4, "why this slot" text for the optimizer, reason for every change |
| **Testing** | unit (rules, constraints), contract (C4 payloads), model tests (beats baseline), load test (p95 < 2 s) |
| **Viva evidence** | notebook per model: data → training → baseline comparison → plots |

New dependencies: `torch`, `ortools`, `shap` (plus existing `xgboost`, `transformers`, `sentence-transformers`).
Models are trained offline in `ml_training/scheduler/`; the API only loads files from `ml_models/scheduler/`.
