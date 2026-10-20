"""
Component 3 - request / response shapes (Pydantic).

    *Create  = what the student SENDS when making something
    *Update  = what the student SENDS when changing something (every field optional)
    *Out     = what the API SENDS BACK

Validation here means bad data never reaches the database
(e.g. a deadline in the past, priority 9, a 0-minute task).
"""
import datetime as dt
from datetime import datetime, time, timezone
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

# Allowed values - must match the constants in models.py
CognitiveLoad = Literal["low", "medium", "heavy"]
TaskType = Literal["assignment", "exam_prep", "lecture_review", "project", "reading", "career", "other"]
TaskStatus = Literal["pending", "in_progress", "done", "missed", "cancelled"]


def to_utc_naive(value: datetime | None) -> datetime | None:
    """
    The database stores times as UTC without a timezone.
    The browser usually sends "2026-10-20T10:00:00+05:30" -> convert it to UTC first.
    """
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


# ===========================================================================
# TASKS
# ===========================================================================
class TaskCreate(BaseModel):
    """Body of POST /api/scheduler/tasks"""
    model_config = ConfigDict(extra="forbid")   # reject unknown fields (catches typos)

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    task_type: TaskType = "other"
    deadline: datetime
    estimated_minutes: int = Field(ge=5, le=24 * 60)        # 5 minutes .. 1 day
    priority: int = Field(default=3, ge=1, le=5)             # 1 = low, 5 = high
    is_flexible: bool = True

    # Optional: if the student picks the load, we keep it.
    # If empty, the system decides (later: M2 classifier, for now "medium").
    cognitive_load: CognitiveLoad | None = None

    # Optional: makes this task a SUBTASK of another task
    parent_id: str | None = None

    # Optional (FR-04): plan this task only after that task is finished
    after_task_id: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title cannot be empty")
        return v

    @field_validator("deadline")
    @classmethod
    def deadline_in_future(cls, v: datetime) -> datetime:
        v = to_utc_naive(v)
        if v <= datetime.utcnow():
            raise ValueError("deadline must be in the future")
        return v


class TaskUpdate(BaseModel):
    """Body of PATCH /api/scheduler/tasks/{id} - send only the fields you want to change."""
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    task_type: TaskType | None = None
    deadline: datetime | None = None
    estimated_minutes: int | None = Field(default=None, ge=5, le=24 * 60)
    after_task_id: str | None = None                          # FR-04: null = no longer depends on a task
    predicted_minutes: int | None = Field(default=None, ge=5, le=24 * 60)   # student sets the real duration (overrides M3)
    priority: int | None = Field(default=None, ge=1, le=5)
    is_flexible: bool | None = None
    cognitive_load: CognitiveLoad | None = None   # changing this = student overrides the AI
    status: TaskStatus | None = None
    scheduled_start: datetime | None = None       # move the planned session (send null to unplan it)

    @field_validator("deadline", "scheduled_start")
    @classmethod
    def normalise_deadline(cls, v: datetime | None) -> datetime | None:
        # Past deadlines are allowed here (e.g. fixing a typo on an old task),
        # only the timezone is normalised.
        return to_utc_naive(v)


class TaskOut(BaseModel):
    """One task as returned by the API."""
    model_config = ConfigDict(from_attributes=True)   # build directly from the SQLAlchemy row

    id: str
    parent_id: str | None
    title: str
    description: str | None
    task_type: str
    deadline: datetime
    estimated_minutes: int
    priority: int
    is_flexible: bool

    cognitive_load: str
    load_confidence: float | None
    load_set_by_student: bool
    predicted_minutes: int | None

    source: str
    scheduled_start: datetime | None
    status: str
    actual_minutes: int | None
    completed_at: datetime | None
    after_task_id: str | None = None                          # FR-04 dependency
    created_at: datetime
    updated_at: datetime


class TaskDetailOut(TaskOut):
    """GET /tasks/{id} - the task plus its subtasks."""
    subtasks: list[TaskOut] = []


# Old name kept so existing code/tests that import TaskIn still work.
TaskIn = TaskCreate


# ===========================================================================
# COMMITMENTS  (FR-02) - lectures, work hours = time the scheduler can't use
# ===========================================================================
CommitmentKind = Literal["lecture", "work", "extracurricular", "personal", "protected_block"]


class CommitmentCreate(BaseModel):
    """
    Body of POST /api/scheduler/commitments

    Two types:
      weekly   -> is_recurring=true,  weekday + start_time + end_time (Sri Lanka time)
      one-off  -> is_recurring=false, start_at + end_at
    """
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    kind: CommitmentKind = "lecture"
    is_recurring: bool = True

    # weekly
    weekday: int | None = Field(default=None, ge=0, le=6)   # 0 = Monday, 6 = Sunday
    start_time: time | None = None                          # e.g. "08:30"
    end_time: time | None = None                            # e.g. "10:30"

    # one-off
    start_at: datetime | None = None
    end_at: datetime | None = None

    # optional: only repeat inside this date range (e.g. this semester)
    valid_from: datetime | None = None
    valid_until: datetime | None = None

    @field_validator("start_at", "end_at", "valid_from", "valid_until")
    @classmethod
    def utc(cls, v):
        return to_utc_naive(v)

    @model_validator(mode="after")
    def check_times(self):
        # Weekly: need day + start + end, and end after start
        if self.is_recurring:
            if self.weekday is None or self.start_time is None or self.end_time is None:
                raise ValueError("weekly commitment needs weekday, start_time and end_time")
            if self.end_time <= self.start_time:
                raise ValueError("end_time must be after start_time (split overnight items in two)")
        # One-off: need start + end, and end after start
        else:
            if self.start_at is None or self.end_at is None:
                raise ValueError("one-off commitment needs start_at and end_at")
            if self.end_at <= self.start_at:
                raise ValueError("end_at must be after start_at")
        if self.valid_from and self.valid_until and self.valid_until <= self.valid_from:
            raise ValueError("valid_until must be after valid_from")
        return self


class CommitmentUpdate(BaseModel):
    """Body of PATCH /commitments/{id} - send only what changed (checked again after merging)."""
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: CommitmentKind | None = None
    is_recurring: bool | None = None
    weekday: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    valid_from: datetime | None = None
    valid_until: datetime | None = None


class CommitmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    kind: str
    is_recurring: bool
    weekday: int | None
    start_time: time | None
    end_time: time | None
    start_at: datetime | None
    end_at: datetime | None
    valid_from: datetime | None
    valid_until: datetime | None
    created_at: datetime


# ===========================================================================
# AVAILABILITY + CONFLICTS
# ===========================================================================
class SlotOut(BaseModel):
    """One block of free time (UTC)."""
    start: datetime
    end: datetime
    minutes: int


class DayAvailabilityOut(BaseModel):
    date: str              # Sri Lanka date, e.g. "2026-10-14"
    free_minutes: int
    slots: list[SlotOut]


class AvailabilityOut(BaseModel):
    days: list[DayAvailabilityOut]
    total_free_minutes: int


class ConflictOut(BaseModel):
    type: Literal["overlap", "impossible_deadline"]
    message: str                 # plain-language explanation for the student
    ids: list[str]               # commitment ids (overlap) or task ids (deadline)


# ===========================================================================
# FOCUS SESSIONS  (FR-05, FR-15)
# ===========================================================================
TimerSource = Literal["student_fixed", "static_default", "m1_model", "history_rules", "survey", "default"]


class TimerRecommendationOut(BaseModel):
    """The timer length the system suggests before a session starts."""
    focus_minutes: int
    break_minutes: int
    source: TimerSource      # where the number came from (shown to the student + kept for research)
    reason: str              # plain-language explanation


class FocusStartIn(BaseModel):
    """Body of POST /focus/start"""
    model_config = ConfigDict(extra="forbid")

    task_id: str | None = None                                       # which task (optional)
    planned_minutes: int | None = Field(default=None, ge=5, le=180)  # empty = accept the suggestion


class FocusEndIn(BaseModel):
    """Body of POST /focus/{id}/end - the rating is optional."""
    model_config = ConfigDict(extra="forbid")

    focus_rating: int | None = Field(default=None, ge=1, le=5)   # "How was your focus?" 1..5


class FocusRatingIn(BaseModel):
    """Body of POST /focus/{id}/rating - rate after the session ended."""
    model_config = ConfigDict(extra="forbid")

    focus_rating: int = Field(ge=1, le=5)


class FocusSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str | None
    started_at: datetime
    ended_at: datetime | None
    planned_minutes: int
    actual_minutes: int
    completed: bool
    pause_count: int
    paused_at: datetime | None       # not null = paused right now
    paused_seconds: int
    paused_minutes: int
    focus_rating: int | None
    task_load: str | None
    mode: str
    was_missed: bool                 # planned but never started
    auto_closed: bool                # left open too long -> closed by the system
    is_valid: bool                   # False = not used for M1 training
    timer_recommended: bool
    timer_overridden: bool


class FocusSummaryOut(BaseModel):
    """
    Numbers for the dashboard, over ALL sessions that match the filters.
    Missed sessions are counted separately - they are NOT in the completion rate
    (completion rate = completed / sessions that were actually started).
    """
    sessions: int                      # started sessions
    missed: int                        # planned sessions that were never started
    auto_closed: int                   # sessions left open too long (not in the numbers below)
    completed: int
    completion_rate: float | None      # 0..1, None if there are no sessions
    total_focus_minutes: int
    average_focus_minutes: float | None
    total_pauses: int
    average_rating: float | None       # only sessions that were rated


class MissedCheckOut(BaseModel):
    """Response of POST /focus/missed/check"""
    new_missed: list[FocusSessionOut]  # missed sessions found in this check


class FocusHistoryOut(BaseModel):
    """Response of GET /focus/history"""
    items: list[FocusSessionOut]       # one page, newest first
    total: int                         # how many sessions match (all pages)
    summary: FocusSummaryOut


class FocusEndOut(BaseModel):
    """Response of POST /focus/{id}/end: the finished session + rewards."""
    session: FocusSessionOut
    xp_awarded: int          # 0 if the session was not completed
    total_xp: int
    level: int
    streak: int = 0          # study days in a row
    new_badges: list[str] = []   # badge codes earned by this session (show a celebration)


class FocusStartOut(BaseModel):
    """Response of POST /focus/start: the new session + what we had suggested."""
    session: FocusSessionOut
    recommendation: TimerRecommendationOut


# ===========================================================================
# SETTINGS - one row per student
# ===========================================================================
class SettingsOut(BaseModel):
    """What GET /settings returns. mode / pilot_group are shown but the student can't change them."""
    model_config = ConfigDict(from_attributes=True)

    mode: str
    pilot_group: str | None
    day_start_hour: int
    day_end_hour: int
    max_study_minutes_per_day: int
    preferred_hours: list[int]
    usual_focus_minutes: int
    focus_tracking_enabled: bool
    stress_adaptation_enabled: bool
    fixed_timer_minutes: int | None


class SettingsUpdate(BaseModel):
    """
    Body of PATCH /settings - send only what changed.
    mode and pilot_group are NOT here on purpose: only the researcher sets them
    (if a student could change their own mode, the pilot experiment would break).
    """
    model_config = ConfigDict(extra="forbid")      # sending "mode" -> 422

    day_start_hour: int | None = Field(default=None, ge=0, le=23)
    day_end_hour: int | None = Field(default=None, ge=1, le=24)
    max_study_minutes_per_day: int | None = Field(default=None, ge=60, le=16 * 60)
    preferred_hours: list[int] | None = Field(default=None, max_length=24)
    usual_focus_minutes: int | None = Field(default=None, ge=10, le=120)
    focus_tracking_enabled: bool | None = None
    stress_adaptation_enabled: bool | None = None
    fixed_timer_minutes: int | None = Field(default=None, ge=5, le=180)   # send null to clear

    @field_validator("preferred_hours")
    @classmethod
    def valid_hours(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return v
        if any(h < 0 or h > 23 for h in v):
            raise ValueError("hours must be between 0 and 23")
        return sorted(set(v))                         # remove duplicates, keep in order


# ===========================================================================
# STRESS ADAPTATION (Module F)
# ===========================================================================
StressAction = Literal["none", "propose_changes", "already_proposed", "off"]


class StressStatusOut(BaseModel):
    """What the scheduler does with Component 4's latest wellbeing signal."""
    level: Literal["LOW", "MODERATE", "HIGH"] | None   # None = no signal shared
    risk_score: float | None
    trend: Literal["FALLING", "STABLE", "RISING"] | None
    signal_event_id: str | None
    signal_received_at: datetime | None
    fresh: bool                      # received in the last 24 h
    adaptation_on: bool              # student's own switch (settings)
    mode: str                        # experiment mode
    action: StressAction             # what happens next
    reason: str                      # plain-language explanation for the student


class TaskSafetyRow(BaseModel):
    task_id: str
    title: str
    deadline: datetime
    priority: int
    cognitive_load: str
    reason: str                      # why it is locked / why it may be changed


class TaskSafetyOut(BaseModel):
    """Which tasks stress-based changes may touch (changeable) and which never (locked)."""
    changeable: list[TaskSafetyRow]
    locked: list[TaskSafetyRow]


class ProposedChange(BaseModel):
    """One suggested change. action: move (to a later time) / split (into pieces) / rest (add a break)."""
    action: Literal["move", "split", "rest"]
    task_id: str | None
    title: str
    reason: str
    old_start: str | None = Field(default=None, validation_alias=AliasChoices("from", "old_start"))  # move: old slot
    to: str | None = None            # move: new planned start (UTC, ISO)
    pieces: list[int] | None = None  # split: minutes per piece
    minutes: int | None = None       # rest: length of the break


class AppliedChange(ProposedChange):
    """A change after the student's decision: was it really applied?"""
    applied: bool
    skipped_because: str | None = None   # e.g. "you are working on it now" (safety re-check)
    created_ids: list[str] | None = None  # pieces / break created (removed again by restore)


class StressProposalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    signal_event_id: str | None
    reason: str                      # one-sentence summary for the student
    change_set: list[ProposedChange]
    decision: str                    # proposed / accepted / edited / rejected / restored
    created_at: datetime
    decided_at: datetime | None
    applied: list[AppliedChange] | None = Field(default=None, validation_alias="edited_change_set")


class StressDecisionIn(BaseModel):
    """accepted = all changes, edited = only the positions in `keep`, rejected = none."""
    model_config = ConfigDict(extra="forbid")

    decision: Literal["accepted", "edited", "rejected"]
    keep: list[int] | None = None    # only for "edited", e.g. [0, 2]

    @model_validator(mode="after")
    def keep_only_when_edited(self):
        if self.decision == "edited" and not self.keep:
            raise ValueError("send keep (which changes to apply) when decision is edited")
        if self.decision != "edited" and self.keep is not None:
            raise ValueError("keep is only used when decision is edited")
        return self


# ===========================================================================
# GAMIFICATION PROGRESS (Module G)
# ===========================================================================
class StreakOut(BaseModel):
    current: int                     # study days in a row
    today_done: bool                 # a completed session today already?
    freeze_left_this_week: int       # 1 missed day per week is forgiven
    stress_days_skipped: int         # HIGH-stress days that did not break the streak


class BadgeOut(BaseModel):
    code: str
    emoji: str
    title: str
    description: str                 # how to earn it
    earned: bool
    earned_at: datetime | None
    progress: int                    # towards target (capped at target)
    target: int


class MilestoneOut(BaseModel):
    code: str
    title: str
    unit: str                        # focus_minutes / tasks_done / study_days
    target: int
    progress: int                    # capped at target
    xp: int                          # bonus XP when reached
    earned: bool
    earned_at: datetime | None


class ProgressOut(BaseModel):
    total_xp: int
    level: int
    xp_to_next_level: int
    streak: StreakOut
    badges: list[BadgeOut]
    new_badges: list[str]            # earned just now
    milestones: list[MilestoneOut] = []
    new_milestones: list[str] = []   # reached just now


# ===========================================================================
# ATTENTION PROFILE (M1)
# ===========================================================================
class HourChance(BaseModel):
    hour: int                        # 0..23, Sri Lanka time
    chance: float                    # M1: chance a 25-min session at this hour is completed


class AttentionProfileOut(BaseModel):
    source: Literal["m1_model", "not_enough_history", "model_unavailable"]
    reason: str
    sessions_used: int
    min_sessions: int
    hourly: list[HourChance] | None = None
    peak_hours: list[int] | None = None        # best 3, best first
    low_hours: list[int] | None = None         # worst 3, worst first
    capacity_minutes: int | None = None        # longest session before success drops
    recommended_focus: int | None = None       # suggested Pomodoro (15-50)


# ===========================================================================
# C3 -> C4 WEEKLY SUMMARY (DeviationSignal)
# ===========================================================================
class WeeklySummarySentOut(BaseModel):
    week_start: str                                              # Monday (Sri Lanka time), e.g. "2026-10-12"
    status: Literal["SENT", "ALREADY_SENT", "TRACKING_OFF"]
    event_id: str | None = None
    task_completion_rate: float | None = None
    missed_sessions: int | None = None
    task_load: int | None = None
    deadline_density: float | None = None
    semester_phase: str | None = None


# ===========================================================================
# PLAN MY WEEK (Module D - CP-SAT scheduler)
# ===========================================================================
class PlannedSessionOut(BaseModel):
    id: str
    task_id: str
    title: str
    load: str
    start: datetime                  # UTC
    end: datetime
    minutes: int
    break_minutes: int
    piece: int                       # piece 2 ...
    of: int                          # ... of 3
    chance: float | None             # M1 chance of finishing it here (adaptive only)
    deadline: datetime


class UnplacedTaskOut(BaseModel):
    task_id: str
    title: str
    minutes: int                     # work that did not fit
    reason: str


class PlanOut(BaseModel):
    mode: str                        # adaptive / static / attention_only
    sessions: list[PlannedSessionOut]


class PlanBuiltOut(PlanOut):
    plan_id: str
    status: str                      # OPTIMAL / FEASIBLE (CP-SAT)
    latency_ms: int
    focus_minutes: int               # piece size used
    break_minutes: int
    timer_source: str                # m1_model / history_rules / survey / static_default ...
    attention_source: str            # m1_model / survey / none
    peak_hours: list[int]            # M1 best hours (Sri Lanka clock), empty if not from M1
    unplaced: list[UnplacedTaskOut]


class SuggestedStep(BaseModel):
    title: str
    minutes: int
    load: str


class SuggestedStepsOut(BaseModel):
    """FR-03: a task cut into steps that fit the student's focus length (M1 / rules / survey)."""
    task_id: str
    focus_minutes: int
    source: str                      # m1_model / history_rules / survey / static_default / default ...
    reason: str
    steps: list[SuggestedStep]


class MissedPieceOut(BaseModel):
    task_id: str
    title: str
    start: datetime
    end: datetime
    minutes: int
    piece: int
    of: int


class RecoveryMoveOut(BaseModel):
    task_id: str
    title: str
    new_start: datetime              # first new time of that task's work


class RecoveryOut(BaseModel):
    """FR-09: missed study sessions + a recovery plan preview (nothing saved until the student applies it)."""
    missed: list[MissedPieceOut]
    moves: list[RecoveryMoveOut]
    at_risk: list[UnplacedTaskOut]   # deadlines rechecked: work that no longer fits
    deadlines_ok: bool


# ===========================================================================
# PILOT STUDY (researcher only) - experiment mode per participant, by research_id
# ===========================================================================
class ParticipantOut(BaseModel):
    research_id: str                 # pseudonymous - no name / email (NFR-05)
    mode: str
    pilot_group: str | None
    completed_sessions: int
    tasks_done: int
    last_active: datetime | None


class ParticipantsOut(BaseModel):
    participants: list[ParticipantOut]
    without_consent: int             # students not shown because they did not consent


class ParticipantModeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["static", "adaptive", "attention_only"] | None = None
    pilot_group: Literal["AB", "BA", ""] | None = None     # "" clears it


class ParticipantModeOut(BaseModel):
    research_id: str
    mode: str
    pilot_group: str | None


class ResearcherOut(BaseModel):
    is_researcher: bool
    research_withdrawn_at: datetime | None = None   # the student left the study (proposal 3.2.2)


class WithdrawIn(BaseModel):
    """Body of POST /research/me/withdraw - must say yes on purpose."""
    model_config = ConfigDict(extra="forbid")
    confirm: Literal[True]


class WithdrawOut(BaseModel):
    research_withdrawn_at: datetime
    records_deleted: int


class DurationOut(BaseModel):
    """M3: how long a task will really take (Objective 2)."""
    task_id: str
    estimated_minutes: int           # what the student said
    predicted_minutes: int | None    # what the plan uses (M3 or the student's own choice)
    model_minutes: int | None        # what M3 says right now (differs from predicted = student kept their own)
    low: int | None                  # 10% - 90% range from M3
    high: int | None
    history_used: int                # finished tasks with logged time that M3 learned from
    source: str                      # m3_model / model_unavailable


class UsefulnessIn(BaseModel):
    """1-5: how helpful a stress suggestion / timer length was (evaluation, proposal Table 3)."""
    model_config = ConfigDict(extra="forbid")
    rating: int = Field(ge=1, le=5)


class UsefulnessOut(BaseModel):
    id: str
    rating: int


class FocusAlertOut(BaseModel):
    """FR-16: a sustained drop in focus quality or study habit (no diagnosis)."""
    alert: bool
    kind: Literal["quality", "habit"] | None
    title: str | None
    message: str | None
    details: dict                    # recent vs usual: sessions, finished_rate, avg_rating, days_per_week


class FocusAlertDismissIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["quality", "habit"]


class NotificationOut(BaseModel):
    id: str                          # stable key, e.g. "due-<task id>"
    category: Literal["Schedule", "Focus", "Wellbeing", "Achievements"]
    icon: str                        # calendar / timer / heart / trophy
    title: str
    body: str
    at: datetime
    link: str                        # page to open
    unread: bool


class NotificationsOut(BaseModel):
    items: list[NotificationOut]
    unread: int


# ===========================================================================
# VOICE PLANNER "Speak your day" (M4)
# ===========================================================================
class BrainDumpIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=2, max_length=2000)


class BrainDumpItemOut(BaseModel):
    index: int
    text: str                        # the piece of what was said
    type: str                        # task_academic / task_personal / commitment / routine / energy / plan_request / other
    confidence: float                # M4 probability
    needs_check: bool                # low confidence or a missing detail -> highlight it
    include: bool                    # "other" pieces start unticked
    title: str
    kind: str | None                 # commitment kind / task type / energy level
    date: dt.date | None
    start: str | None                # "HH:MM" Sri Lanka time
    end: str | None
    duration_minutes: int | None
    deadline: dt.date | None
    in_minutes: int | None
    after_previous: bool
    load: str | None                 # M2
    predicted_minutes: int | None    # M3
    warning: str | None = None       # e.g. a 10-hour breakfast: probably a misheard time
    urgent: bool = False             # "urgent exam" -> top priority when saved


class BrainDumpOut(BaseModel):
    items: list[BrainDumpItemOut]
    plan_requested: bool
    energy: str | None               # low / high, if the student said so
    today: dt.date
    model: str | None                # m4_model / keyword_rules
    ignored: list[str] = []          # filler the student said ("yeah", "sorry") - shown, not made into cards


class BrainDumpSaveItem(BaseModel):
    """One card the student checked (and maybe edited) on the review screen."""
    model_config = ConfigDict(extra="forbid")

    type: Literal["task_academic", "task_personal", "commitment", "routine"]
    title: str = Field(min_length=1, max_length=200)
    kind: str | None = Field(default=None, max_length=40)       # commitment kind / task type
    date: dt.date | None = None                                 # commitment day (default today)
    start: time | None = None                                   # Sri Lanka clock
    end: time | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=24 * 60)
    deadline: dt.date | None = None                             # tasks
    load: CognitiveLoad | None = None                           # kept only if the student changed it
    urgent: bool = False                                        # -> priority 5
    # learning loop: what M4 said and what the student changed (no spoken text is stored)
    model_type: str | None = Field(default=None, max_length=40)
    confidence: float | None = Field(default=None, ge=0, le=1)
    changed: list[str] = Field(default_factory=list, max_length=20)


class BrainDumpConfirmIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[BrainDumpSaveItem] = Field(default_factory=list, max_length=30)
    energy: Literal["low", "high"] | None = None
    plan: bool = False                                          # run Plan my week after saving
    dropped: int = Field(default=0, ge=0, le=100)               # cards the student unticked


class SavedRef(BaseModel):
    id: str
    title: str


class BrainDumpSavedOut(BaseModel):
    tasks: list[SavedRef]
    commitments: list[SavedRef]
    planned: bool
    sessions: int | None             # planned pieces (if a plan was made)
    unplaced: int | None
    today_cap_minutes: int | None    # lowered study cap for today (low energy)
