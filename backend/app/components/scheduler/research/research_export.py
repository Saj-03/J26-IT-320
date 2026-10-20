"""
Component 3 - RESEARCH EXPORT (FR-12): the pilot metrics of proposal Table 3, one CSV row per
participant x experiment mode (AB/BA design: the same student is in both modes, at different times).

Pseudonymous: research_id only - no name, email, task titles or free text (NFR-05).
Only students who gave research consent are exported.

Which mode does a record belong to?
    focus sessions / planned pieces -> the mode saved on the row when it was made
    tasks / audit events            -> the student's mode at that moment (from "pilot_mode_changed" history)

Columns (blank = not enough data):
    task_completion_rate, deadline_adherence, reschedules_per_task_week, manual_edits_per_week,
    duration_mae_student, duration_mae_m3, focus_completion_rate, attention_capacity_mae,
    focus_duration_mae, heavy_success_peak / heavy_success_other, timer_acceptance, timer_usefulness,
    deferral_acceptance, deferral_helpfulness, active_days, completed_sessions, plan_latency_p95_ms,
    engagement (Table 3: "streak retention and reward interactions"): longest_streak_days, xp_earned, badges_earned,
    risk_handling_median_min, peak_window_stability
"""
import csv
import io
import statistics
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.components.scheduler.focus import attention_service
from app.components.scheduler.tasks.commitment_service import SL_OFFSET
from app.components.scheduler.ml import m1_predictor
from app.components.scheduler.models import (
    FocusSession, PlannedSession, RewardEvent, ScheduleChange, SchedulerAuditLog, SchedulerSettings, Task,
)
from app.components.scheduler.rewards.progress_service import study_day
from app.components.scheduler.research.research_service import require_researcher, withdrawn_ids
from app.components.scheduler.settings_service import DEFAULTS
from app.components.scheduler.stress.stress_service import STRESS_TRIGGER
from app.shared.integration.models import SignalEvent
from app.shared.users.models import User

MIN_LOGGED = 5                     # minutes - a finished task with less logged time is not used for duration error
MANUAL_EDIT_FIELDS = {"scheduled_start", "deadline", "estimated_minutes", "predicted_minutes"}
COLUMNS = [
    "research_id", "mode", "pilot_group", "days_in_mode",
    "tasks_scheduled", "tasks_done", "task_completion_rate", "deadline_adherence",
    "reschedules_per_task_week", "manual_edits_per_week",
    "duration_mae_student", "duration_mae_m3",
    "sessions_started", "completed_sessions", "focus_completion_rate",
    "attention_capacity_mae", "focus_duration_mae", "heavy_success_peak", "heavy_success_other",
    "timer_acceptance", "timer_usefulness", "deferral_acceptance", "deferral_helpfulness",
    "active_days", "longest_streak_days", "xp_earned", "badges_earned",
 "plan_latency_p95_ms", "risk_handling_median_min", "peak_window_stability",
]


def rate(part, whole):
    return round(part / whole, 3) if whole else None


def mean(values):
    values = [v for v in values if v is not None]
    return round(statistics.fmean(values), 2) if values else None


# ---------------------------------------------------------------------------
# Mode history
# ---------------------------------------------------------------------------
def mode_timeline(db: Session, user) -> list[tuple[datetime, str]]:
    """[(from_time, mode), ...] oldest first, from the researcher's audited mode changes."""
    changes = (db.query(SchedulerAuditLog)
                 .filter_by(user_id=user.id, event_type="pilot_mode_changed")
                 .order_by(SchedulerAuditLog.created_at).all())
    row = db.get(SchedulerSettings, user.id)
    current = row.mode if row else DEFAULTS["mode"]
    if not changes:
        return [(datetime.min, current)]
    timeline = [(datetime.min, changes[0].details["old"]["mode"])]
    timeline += [(c.created_at, c.details["new"]["mode"]) for c in changes]
    return timeline


def mode_at(timeline, moment: datetime | None) -> str:
    mode = timeline[0][1]
    for start, m in timeline:
        if moment is not None and moment >= start:
            mode = m
    return mode if moment is not None else timeline[-1][1]


# ---------------------------------------------------------------------------
# Metrics for one participant
# ---------------------------------------------------------------------------
def peak_window_stability(sessions: list[FocusSession]) -> float | None:
    """Average overlap (Jaccard) of the M1 top-3 hours between consecutive weekly profiles."""
    if not m1_predictor.available() or len(sessions) < attention_service.MIN_SESSIONS:
        return None
    first, last = sessions[0].started_at, sessions[-1].started_at
    hours = list(range(7, 24))
    peaks, week_end = [], first + timedelta(days=7)
    while week_end <= last + timedelta(days=7):
        seen = [s for s in sessions if s.started_at < week_end]
        if len(seen) >= attention_service.MIN_SESSIONS:
            peaks.append(set(m1_predictor.M1Student(seen, week_end).profile(hours)["peak_hours"]))
        week_end += timedelta(days=7)
    overlaps = [len(a & b) / len(a | b) for a, b in zip(peaks, peaks[1:])]
    return round(statistics.fmean(overlaps), 3) if overlaps else None


def longest_streak(days: set) -> int:
    """Most study days in a row (dates with at least one finished focus session)."""
    best = 0
    for d in days:
        if d - timedelta(days=1) not in days:                         # the first day of a run
            n = 1
            while d + timedelta(days=n) in days:
                n += 1
            best = max(best, n)
    return best


def participant_rows(db: Session, student: User, now: datetime) -> list[dict]:
    timeline = mode_timeline(db, student)
    row = db.get(SchedulerSettings, student.id)
    group = row.pilot_group if row else None

    sessions = (db.query(FocusSession).filter(FocusSession.user_id == student.id)
                  .order_by(FocusSession.started_at).all())
    started = [s for s in sessions if s.ended_at and s.is_valid and not s.was_missed]
    tasks = db.query(Task).filter(Task.user_id == student.id).all()
    planned_ids = {t for (t,) in db.query(PlannedSession.task_id).filter(PlannedSession.user_id == student.id)}
    parent_ids = {t.parent_id for t in tasks if t.parent_id}
    events = db.query(SchedulerAuditLog).filter(SchedulerAuditLog.user_id == student.id).all()
    proposals = (db.query(ScheduleChange)
                   .filter(ScheduleChange.user_id == student.id, ScheduleChange.trigger == STRESS_TRIGGER).all())
    signals = {e.event_id: e.received_at for e in db.query(SignalEvent).filter(
        SignalEvent.student_id == student.research_id, SignalEvent.signal_type == "RISK")}

    profile = attention_service.attention_profile(db, student, now) if len(started) >= attention_service.MIN_SESSIONS else {}
    peaks = set(profile.get("peak_hours") or [])
    stability = peak_window_stability(started)

    # days spent in each mode (for "per week" numbers)
    first_seen = min([s.started_at for s in sessions] + [t.created_at for t in tasks if t.created_at] + [now])
    days = defaultdict(float)
    bounds = [max(start, first_seen) for start, _ in timeline] + [now]
    for (start, mode), begin, end in zip(timeline, bounds, bounds[1:]):
        days[mode] += max((end - begin).total_seconds() / 86400, 0)

    by_mode = defaultdict(lambda: defaultdict(list))
    for s in sessions:
        by_mode[s.mode]["sessions"].append(s)
    for t in tasks:
        by_mode[mode_at(timeline, t.completed_at or t.deadline)]["tasks"].append(t)
    for e in events:
        by_mode[e.mode or mode_at(timeline, e.created_at)]["events"].append(e)
    for p in proposals:
        by_mode[mode_at(timeline, p.created_at)]["proposals"].append(p)
    for r in db.query(RewardEvent).filter(RewardEvent.user_id == student.id).all():
        by_mode[mode_at(timeline, r.created_at)]["rewards"].append(r)

    rows = []
    for mode, d in by_mode.items():
        mode_sessions = [s for s in d["sessions"] if s.ended_at and s.is_valid and not s.was_missed]
        leaf_tasks = [t for t in d["tasks"] if t.id not in parent_ids]   # a big task counts through its steps
        scheduled = [t for t in leaf_tasks if t.id in planned_ids or t.scheduled_start]
        done = [t for t in leaf_tasks if t.status == "done"]
        timed = [t for t in done if (t.actual_minutes or 0) >= MIN_LOGGED]
        evs = d["events"]
        manual = [e for e in evs if e.event_type == "task_updated" and MANUAL_EDIT_FIELDS & set(e.details.get("fields", []))]
        moved = [e for e in manual if "scheduled_start" in e.details.get("fields", [])]
        weeks = max(days.get(mode, 0) / 7, 1 / 7)
        recommended = [s for s in mode_sessions if s.timer_recommended]
        heavy = [s for s in mode_sessions if s.task_load == "heavy"]
        heavy_peak = [s for s in heavy if peaks and (s.started_at + SL_OFFSET).hour in peaks]
        heavy_other = [s for s in heavy if peaks and (s.started_at + SL_OFFSET).hour not in peaks]
        decided = [p for p in d["proposals"] if p.decision != "proposed"]
        latencies = sorted(e.latency_ms for e in evs if e.event_type == "plan_generated" and e.latency_ms is not None)
        handling = [(p.created_at - signals[p.signal_event_id]).total_seconds() / 60
                    for p in d["proposals"] if p.signal_event_id in signals]

        rows.append({
            "research_id": student.research_id, "mode": mode, "pilot_group": group,
            "days_in_mode": round(days.get(mode, 0), 1),
            "tasks_scheduled": len(scheduled), "tasks_done": len([t for t in scheduled if t.status == "done"]),
            "task_completion_rate": rate(len([t for t in scheduled if t.status == "done"]), len(scheduled)),
            "deadline_adherence": rate(len([t for t in done if t.completed_at and t.completed_at <= t.deadline]), len(done)),
            "reschedules_per_task_week": round(len(moved) / max(len(scheduled), 1) / weeks, 3),
            "manual_edits_per_week": round(len(manual) / weeks, 2),
            "duration_mae_student": mean([abs(t.estimated_minutes - t.actual_minutes) for t in timed]),
            "duration_mae_m3": mean([abs(t.predicted_minutes - t.actual_minutes) for t in timed if t.predicted_minutes]),
            "sessions_started": len(mode_sessions), "completed_sessions": sum(s.completed for s in mode_sessions),
            "focus_completion_rate": rate(sum(s.completed for s in mode_sessions), len(mode_sessions)),
            "attention_capacity_mae": mean([abs(s.planned_minutes - s.actual_minutes) for s in recommended]),
            "focus_duration_mae": mean([abs(s.planned_minutes - s.actual_minutes) for s in mode_sessions]),
            "heavy_success_peak": rate(sum(s.completed for s in heavy_peak), len(heavy_peak)),
            "heavy_success_other": rate(sum(s.completed for s in heavy_other), len(heavy_other)),
            "timer_acceptance": rate(len([s for s in recommended if not s.timer_overridden]), len(recommended)),
            "timer_usefulness": mean([e.details["rating"] for e in evs if e.event_type == "timer_rated"]),
            "deferral_acceptance": rate(len([p for p in decided if p.decision in ("accepted", "edited")]), len(decided)),
            "deferral_helpfulness": mean([e.details["rating"] for e in evs if e.event_type == "stress_proposal_rated"]),
            "active_days": len({study_day(s.started_at) for s in mode_sessions}),
            "longest_streak_days": longest_streak({study_day(s.started_at) for s in mode_sessions if s.completed}),
            "xp_earned": sum(r.amount or 0 for r in d["rewards"]),
            "badges_earned": len([r for r in d["rewards"] if r.kind in ("badge", "milestone")]),
            "plan_latency_p95_ms": latencies[max(0, int(len(latencies) * 0.95) - 1)] if latencies else None,
            "risk_handling_median_min": round(statistics.median(handling), 1) if handling else None,
            "peak_window_stability": stability,
        })
    return rows


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
def export_rows(db: Session, researcher, now: datetime | None = None) -> list[dict]:
    require_researcher(researcher)
    now = now or datetime.utcnow()
    gone = withdrawn_ids(db)                                           # left the study (proposal 3.2.2)
    students = db.query(User).filter(User.research_consent.is_(True)).order_by(User.research_id).all()
    return [r for s in students if s.id not in gone for r in participant_rows(db, s, now)]


def export_csv(db: Session, researcher, now: datetime | None = None) -> str:
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=COLUMNS)
    writer.writeheader()
    for row in export_rows(db, researcher, now):
        writer.writerow({k: "" if v is None else v for k, v in row.items()})
    return out.getvalue()
