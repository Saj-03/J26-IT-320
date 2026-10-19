"""
Component 3 - HTTP endpoints, all under /api/scheduler.

Routers stay thin: read the request -> call a service function -> return the result.
Every endpoint needs a logged-in student (get_current_user).
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.components.scheduler import (
    schemas, service, task_service, commitment_service, focus_service, settings_service, stress_service,
    attention_service, progress_service, planner_service, research_service, feedback_service,
    alert_service, research_export, notification_service, insights_service, brain_dump_service,
)
from app.components.scheduler.models import Task, FocusSession, ScheduleChange
from app.components.scheduler.engine import m1_predictor, m3_predictor, stress_rules
from app.shared.integration import c3_weekly_summary as weekly_summary

router = APIRouter()
m1_predictor.warm_up_in_background()      # load the M1 model now, not on the first student's request


# ===========================================================================
# TASKS  (FR-01, FR-03)
# ===========================================================================
@router.post("/tasks", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(data: schemas.TaskCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Add a task (or a subtask, by sending parent_id)."""
    return task_service.create_task(db, user, data)


@router.get("/tasks", response_model=list[schemas.TaskOut])
def list_tasks(
    status_filter: schemas.TaskStatus | None = Query(None, alias="status", description="e.g. pending"),
    top_level_only: bool = Query(False, description="true = hide subtasks"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """All my tasks, earliest deadline first."""
    return task_service.list_tasks(db, user, status_filter, top_level_only)


@router.get("/tasks/{task_id}", response_model=schemas.TaskDetailOut)
def get_task(task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """One task with its subtasks."""
    return task_service.get_task_detail(db, user, task_id)


@router.get("/tasks/{task_id}/duration", response_model=schemas.DurationOut)
def task_duration(task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """M3: how long this task will really take, with a 10-90% range."""
    task = task_service.get_own_task(db, user, task_id)
    p = m3_predictor.predict_task(db, task)
    return {"task_id": task.id, "estimated_minutes": task.estimated_minutes, "predicted_minutes": task.predicted_minutes,
            "model_minutes": p["minutes"] if p else None, "low": p["low"] if p else None, "high": p["high"] if p else None,
            "history_used": p["history_used"] if p else 0, "source": "m3_model" if p else "model_unavailable"}


@router.get("/tasks/{task_id}/suggested-steps", response_model=schemas.SuggestedStepsOut)
def suggested_steps(task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Preview: this task cut into steps that fit my focus length (FR-03). Nothing is saved."""
    return planner_service.suggest_steps(db, user, task_id)


@router.post("/tasks/{task_id}/suggested-steps", response_model=schemas.TaskDetailOut)
def create_suggested_steps(task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Create the suggested steps as subtasks (only if the task has no steps yet)."""
    planner_service.create_suggested_steps(db, user, task_id)
    return task_service.get_task_detail(db, user, task_id)


@router.patch("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: str, data: schemas.TaskUpdate,
                db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Change some fields of a task (send only what changed)."""
    return task_service.update_task(db, user, task_id, data)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Delete a task and its subtasks (focus history is kept)."""
    task_service.delete_task(db, user, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# COMMITMENTS  (FR-02) - lectures, work, clubs = busy time
# ===========================================================================
@router.post("/commitments", response_model=schemas.CommitmentOut, status_code=status.HTTP_201_CREATED)
def create_commitment(data: schemas.CommitmentCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Add a weekly (e.g. Monday lecture) or one-off busy time."""
    return commitment_service.create_commitment(db, user, data)


@router.get("/commitments", response_model=list[schemas.CommitmentOut])
def list_commitments(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """All my commitments."""
    return commitment_service.list_commitments(db, user)


@router.get("/commitments/{commitment_id}", response_model=schemas.CommitmentOut)
def get_commitment(commitment_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return commitment_service.get_own_commitment(db, user, commitment_id)


@router.patch("/commitments/{commitment_id}", response_model=schemas.CommitmentOut)
def update_commitment(commitment_id: str, data: schemas.CommitmentUpdate,
                      db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Change some fields (send only what changed)."""
    return commitment_service.update_commitment(db, user, commitment_id, data)


@router.delete("/commitments/{commitment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_commitment(commitment_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    commitment_service.delete_commitment(db, user, commitment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# FREE TIME + CONFLICTS
# ===========================================================================
@router.get("/availability", response_model=schemas.AvailabilityOut)
def availability(days: int = Query(7, ge=1, le=28, description="how many days ahead"),
                 db: Session = Depends(get_db), user=Depends(get_current_user)):
    """My free study time per day (study window minus commitments)."""
    return commitment_service.get_availability(db, user, days)


@router.get("/conflicts", response_model=list[schemas.ConflictOut])
def conflicts(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Clashing commitments and deadlines I can't meet with my free time."""
    return commitment_service.detect_conflicts(db, user)


# ===========================================================================
# FOCUS SESSIONS  (FR-05, FR-15)
# ===========================================================================
@router.get("/focus/recommendation", response_model=schemas.TimerRecommendationOut)
def timer_recommendation(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Suggested timer length - show this before the student presses Start."""
    return focus_service.recommend_timer(db, user)


@router.post("/focus/start", response_model=schemas.FocusStartOut, status_code=status.HTTP_201_CREATED)
def start_focus(data: schemas.FocusStartIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Start a session. Leave planned_minutes empty to accept the suggestion."""
    return focus_service.start_session(db, user, data)


@router.get("/focus/active", response_model=schemas.FocusSessionOut | None)
def active_focus(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """The running session (null if none) - lets the app restore the timer after a refresh."""
    return focus_service.get_active_session(db, user)


@router.get("/focus/history", response_model=schemas.FocusHistoryOut)
def focus_history(
    date_from: datetime | None = Query(None, alias="from", description="sessions started on/after this time"),
    date_to: datetime | None = Query(None, alias="to", description="sessions started before this time"),
    task_id: str | None = Query(None),
    completed: bool | None = Query(None, description="true = completed only, false = stopped early only"),
    include_missed: bool = Query(True, description="false = hide planned sessions that were never started"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """My finished focus sessions (newest first) + dashboard summary."""
    return focus_service.focus_history(db, user, schemas.to_utc_naive(date_from), schemas.to_utc_naive(date_to),
                                       task_id, completed, include_missed, limit, offset)


@router.post("/focus/missed/check", response_model=schemas.MissedCheckOut)
def check_missed(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Record planned sessions that were not started (call when the app opens - safe to repeat)."""
    return {"new_missed": focus_service.check_missed_sessions(db, user)}


@router.post("/focus/{session_id}/pause", response_model=schemas.FocusSessionOut)
def pause_focus(session_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Pause the running session (counts the pause)."""
    return focus_service.pause_session(db, user, session_id)


@router.post("/focus/{session_id}/resume", response_model=schemas.FocusSessionOut)
def resume_focus(session_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Continue after a pause (adds the pause time to the total)."""
    return focus_service.resume_session(db, user, session_id)


@router.post("/focus/{session_id}/end", response_model=schemas.FocusEndOut)
def end_focus(session_id: str, data: schemas.FocusEndIn | None = None,
              db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Stop the session: real focus time, completed or not, XP. Rating is optional."""
    return focus_service.end_session(db, user, session_id, data or schemas.FocusEndIn())


@router.get("/focus/alert", response_model=schemas.FocusAlertOut)
def focus_alert(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """FR-16: has my focus quality or study habit dropped compared with my usual weeks?"""
    return alert_service.focus_alert(db, user)


@router.post("/focus/alert/dismiss")
def dismiss_focus_alert(data: schemas.FocusAlertDismissIn,
                        db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Hide this kind of alert for 7 days."""
    return alert_service.dismiss(db, user, data.kind)


@router.post("/focus/{session_id}/timer-rating", response_model=schemas.UsefulnessOut)
def rate_timer(session_id: str, data: schemas.UsefulnessIn,
               db: Session = Depends(get_db), user=Depends(get_current_user)):
    """1-5: was the suggested session length useful? (adaptive timer acceptance, once per session)"""
    return feedback_service.rate_timer(db, user, session_id, data.rating)


@router.post("/focus/{session_id}/rating", response_model=schemas.FocusSessionOut)
def rate_focus(session_id: str, data: schemas.FocusRatingIn,
               db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Give (or change) the 1-5 "how was your focus?" rating after ending."""
    return focus_service.rate_session(db, user, session_id, data.focus_rating)


# ===========================================================================
# GAMIFICATION  (FR-10)
# ===========================================================================
@router.get("/progress", response_model=schemas.ProgressOut)
def progress(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """My XP, level, streak and badges (any newly reached badge is given now)."""
    return progress_service.check_progress(db, user)


# ===========================================================================
# VOICE PLANNER "Speak your day" (M4) - preview only, nothing is saved
# ===========================================================================
@router.post("/brain-dump", response_model=schemas.BrainDumpOut)
def brain_dump(data: schemas.BrainDumpIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """A spoken / typed paragraph -> editable items (tasks, commitments, energy, plan request). Saves nothing."""
    return brain_dump_service.preview(db, user, data.text)


@router.post("/brain-dump/confirm", response_model=schemas.BrainDumpSavedOut, status_code=201)
def brain_dump_confirm(data: schemas.BrainDumpConfirmIn, db: Session = Depends(get_db),
                       user=Depends(get_current_user)):
    """Save the cards the student checked (tasks + commitments); plan my week if asked (low energy -> lighter today)."""
    return brain_dump_service.confirm(db, user, data)


# ===========================================================================
# INSIGHTS - real numbers for the Overview and AI Insights pages
# ===========================================================================
@router.get("/insights")
def get_insights(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Last 7 days, this week vs last, best hours (M1), best effort level, estimate vs actual, stress trend."""
    return insights_service.insights(db, user)


# ===========================================================================
# NOTIFICATIONS  (FR-11) - built from real data, unread = newer than the last visit
# ===========================================================================
@router.get("/notifications", response_model=schemas.NotificationsOut)
def get_notifications(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Upcoming sessions, deadlines, missed sessions, focus alert, lighter-plan suggestion, new rewards."""
    return notification_service.notifications(db, user)


@router.post("/notifications/seen")
def notifications_seen(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """The student opened the notifications page -> everything so far counts as read."""
    return notification_service.mark_seen(db, user)


# ===========================================================================
# PLAN MY WEEK  (FR-04, FR-14) - CP-SAT scheduler (Module D)
# ===========================================================================
@router.post("/plan", response_model=schemas.PlanBuiltOut)
def build_plan(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Plan my open tasks for the next 7 days (replaces the future part of my old plan)."""
    return planner_service.build_plan(db, user)


@router.get("/plan", response_model=schemas.PlanOut)
def get_plan(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """My planned study pieces from now on."""
    return planner_service.plan_view(db, user)


@router.get("/plan/recovery", response_model=schemas.RecoveryOut)
def plan_recovery(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """FR-09: planned sessions I missed + where a new plan would put that work (preview, nothing saved).
    Apply it with POST /plan."""
    return planner_service.recovery_preview(db, user)


# ===========================================================================
# ATTENTION PROFILE  (FR-05, FR-13, FR-15) - from the M1 model
# ===========================================================================
@router.get("/attention/profile", response_model=schemas.AttentionProfileOut)
def attention_profile(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """My best / worst focus hours, focus capacity and suggested session length (M1)."""
    return attention_service.attention_profile(db, user)


# ===========================================================================
# SETTINGS
# ===========================================================================
@router.get("/settings", response_model=schemas.SettingsOut)
def get_settings(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """My scheduler settings (defaults if I never changed anything)."""
    return settings_service.get_settings(db, user)


@router.patch("/settings", response_model=schemas.SettingsOut)
def update_settings(data: schemas.SettingsUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Change my settings (send only what changed). Experiment mode can't be changed here."""
    return settings_service.update_settings(db, user, data)


# ===========================================================================
# STRESS ADAPTATION  (FR-06, FR-07) - uses Component 4's wellbeing signal
# ===========================================================================
@router.get("/stress/status", response_model=schemas.StressStatusOut)
def stress_status(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Latest wellbeing signal and what the scheduler will do with it (nothing is changed here)."""
    return stress_service.stress_status(db, user)


@router.get("/stress/task-safety", response_model=schemas.TaskSafetyOut)
def task_safety(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Which of my tasks may be changed when I'm stressed, and why the others are locked."""
    return stress_service.task_safety(db, user)


@router.post("/stress/propose", response_model=schemas.StressProposalOut, status_code=status.HTTP_201_CREATED)
def stress_propose(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Suggest a lighter plan (409 + reason if not needed now). Nothing changes until I accept."""
    return stress_service.propose(db, user)


@router.get("/stress/proposals", response_model=list[schemas.StressProposalOut])
def stress_proposals(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Suggestions still waiting for my decision."""
    return stress_service.list_proposals(db, user)


@router.post("/stress/proposals/{change_id}/decision", response_model=schemas.StressProposalOut)
def stress_decide(change_id: str, data: schemas.StressDecisionIn,
                  db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Accept all, keep only some (edited), or reject. Each change is safety-checked again."""
    return stress_service.decide(db, user, change_id, data.decision, data.keep)


@router.post("/stress/proposals/{change_id}/rating", response_model=schemas.UsefulnessOut)
def rate_stress_proposal(change_id: str, data: schemas.UsefulnessIn,
                         db: Session = Depends(get_db), user=Depends(get_current_user)):
    """1-5: how helpful was this lighter-plan suggestion? (deferral appropriateness, once, after deciding)"""
    return feedback_service.rate_proposal(db, user, change_id, data.rating)


@router.post("/stress/proposals/{change_id}/restore", response_model=schemas.StressProposalOut)
def stress_restore(change_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Undo an accepted proposal - back to the plan I had before."""
    return stress_service.restore(db, user, change_id)


# ===========================================================================
# C3 -> C4 WEEKLY SUMMARY
# ===========================================================================
@router.post("/integration/weekly-summary", response_model=list[schemas.WeeklySummarySentOut])
def send_weekly_summary(weeks: int = Query(1, ge=1, le=weekly_summary.MAX_BACKFILL_WEEKS,
                                           description="how many finished weeks to send (oldest first)"),
                        db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Send my last finished week(s) to Component 4. Safe to repeat - each week is sent once."""
    return weekly_summary.send_recent_weeks(db, user, weeks)


@router.post("/focus")
def log_focus(data: schemas.FocusIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """OLD endpoint: logs an already-finished session in one call (kept for the current frontend)."""
    ended = data.started_at + timedelta(minutes=data.actual_minutes)   # finished -> never "active"
    db.add(FocusSession(user_id=user.id, ended_at=ended, **data.model_dump())); db.commit()
    return {"ok": True}


@router.post("/adapt")
def adapt(db: Session = Depends(get_db), user=Depends(get_current_user)):
    risk = service.latest_risk_level(db, user.research_id)
    tasks = db.query(Task).filter_by(user_id=user.id).all()
    proposal = stress_rules.propose_changes(tasks, risk, datetime.utcnow())
    ch = ScheduleChange(user_id=user.id, reason=proposal["reason"], change_set=proposal["changes"])
    db.add(ch); db.commit()
    return {"change_id": ch.id, **proposal}


@router.post("/changes/{change_id}/decision")
def decide(change_id: str, data: schemas.DecisionIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ch = db.get(ScheduleChange, change_id)
    if not ch or ch.user_id != user.id:
        raise HTTPException(404)
    ch.decision = data.decision; db.commit()
    return {"ok": True}


@router.post("/tasks/{task_id}/complete")
def complete(task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    t = db.get(Task, task_id)
    if not t or t.user_id != user.id:
        raise HTTPException(404)
    return service.complete_task(db, user, t)


# ===========================================================================
# PILOT STUDY  (researcher only) - experiment mode per participant (proposal 3.1)
# ===========================================================================
@router.get("/research/me", response_model=schemas.ResearcherOut)
def research_me(user=Depends(get_current_user)):
    """Am I a researcher? (the frontend shows the pilot controls only then)"""
    return {"is_researcher": research_service.is_researcher(user)}


@router.get("/research/overview")
def research_overview(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Research Dashboard: KPIs, cohort charts and participant table (research IDs only). Researchers only."""
    return research_service.overview(db, user)


@router.get("/research/participants", response_model=schemas.ParticipantsOut)
def research_participants(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Consenting participants by research ID with their mode and activity. Researchers only."""
    return research_service.participants(db, user)


@router.patch("/research/participants/{research_id}", response_model=schemas.ParticipantModeOut)
def research_set_mode(research_id: str, data: schemas.ParticipantModeIn,
                      db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Set a participant's experiment mode (static / adaptive / attention_only) and AB/BA group."""
    return research_service.set_mode(db, user, research_id, data.mode, data.pilot_group)


@router.get("/research/export.csv")
def research_export_csv(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """FR-12: pilot metrics (proposal Table 3) per participant x mode, research IDs only. Researchers only."""
    csv_text = research_export.export_csv(db, user)
    name = f"c3_pilot_metrics_{datetime.utcnow():%Y%m%d}.csv"
    return Response(csv_text, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{name}"'})
