from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.components.burnout import schemas, service
from app.components.burnout.models import JournalEntry, ChatMessage, MoodTap
from app.components.burnout.nlp.sentiment import sentiment
from app.components.burnout.nlp.emotion import emotion
from app.components.burnout.llm import prompts, chat_agent

router = APIRouter()


@router.post("/journal")
def journal(data: schemas.JournalIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    e = JournalEntry(user_id=user.id, mode=data.mode, text=data.text,
                     sentiment=sentiment(data.text), emotion=emotion(data.text))
    db.add(e); db.commit()
    sig = service.publish(db, user)          # closed loop: every journal save refreshes the risk signal
    crisis = prompts.is_crisis(data.text)    # same guardrail as the chat; the entry is still saved
    return {"sentiment": e.sentiment, "emotion": e.emotion, "signal": service.to_out(sig),
            "crisis": crisis, "helplines": prompts.HELPLINES if crisis else []}


@router.get("/journal", response_model=list[schemas.JournalEntryOut])
def journal_list(q: str | None = None, limit: int = 200, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """The student's own entries, newest first. `q` searches the text. Never returns another student's entries."""
    query = db.query(JournalEntry).filter(JournalEntry.user_id == user.id)
    if q and q.strip():
        query = query.filter(JournalEntry.text.ilike(f"%{q.strip()}%"))
    rows = query.order_by(JournalEntry.created_at.desc()).limit(min(max(limit, 1), 500)).all()
    return [schemas.JournalEntryOut(id=r.id, text=r.text, mode=r.mode, created_at=r.created_at.isoformat() + "Z") for r in rows]


@router.delete("/journal/{entry_id}")
def journal_delete(entry_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Delete one of the student's own entries and refresh the signal so it no longer counts."""
    e = db.query(JournalEntry).filter_by(id=entry_id, user_id=user.id).first()
    if not e:
        raise HTTPException(404, "Entry not found")
    db.delete(e); db.commit()
    return {"signal": service.to_out(service.publish(db, user))}


@router.post("/mood")
def mood(data: schemas.MoodIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.add(MoodTap(user_id=user.id, mood=data.mood)); db.commit()
    sig = service.publish(db, user)          # closed loop: every mood tap refreshes the risk signal
    return {"ok": True, "signal": service.to_out(sig)}


@router.post("/chat")
async def chat(data: schemas.ChatIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not service.get_prefs(db, user).chat_enabled:       # chat is opt-in
        raise HTTPException(403, "Chat is turned off. You can turn it on in your wellbeing privacy settings.")
    crisis = prompts.is_crisis(data.message)
    db.add(ChatMessage(user_id=user.id, role="user", content=data.message, sentiment=sentiment(data.message)))
    db.commit()

    if crisis:                       # Layer 1: bypass the LLM completely
        text = prompts.CRISIS_REPLY
    else:
        recent = (db.query(ChatMessage).filter_by(user_id=user.id)
                    .order_by(ChatMessage.created_at.desc()).limit(10).all())
        history = [{"role": m.role, "content": m.content} for m in reversed(recent)]
        ctx = service.build_context(db, user) if data.context_grounded else None
        try:
            text = await chat_agent.reply(prompts.build_system_prompt(ctx), history, ctx)
        except Exception:            # never crash the endpoint on an LLM/network error
            text = prompts.FALLBACK_REPLY

    db.add(ChatMessage(user_id=user.id, role="assistant", content=text)); db.commit()
    return {"reply": text, "crisis_flag": crisis, "helplines": prompts.HELPLINES if crisis else [],
            "knows_your_week": bool(not crisis and data.context_grounded and service.build_context(db, user))}


@router.post("/signal/compute", response_model=schemas.SignalOut)
def compute(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Run fusion; log the RiskSignal (Scheduler) and RecoverySignal (Physical Wellbeing)."""
    return service.to_out(service.publish(db, user))


@router.get("/signal/summary", response_model=schemas.SummaryOut)
def signal_summary(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Read-only: latest stored signal + recent scores for the dashboard."""
    return service.summary(db, user)


@router.post("/demo/{scenario}", response_model=schemas.SignalOut)
def demo(scenario: Literal["bad", "normal"], db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Demo/evaluation: script a 'bad' or 'normal' week for the logged-in student and run the real pipeline."""
    if not settings.DEMO_MODE:
        raise HTTPException(404, "Demo mode is off")
    return service.to_out(service.seed_demo(db, user, scenario))


@router.get("/preferences", response_model=schemas.PreferencesOut)
def get_preferences(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return service.get_prefs(db, user)


@router.put("/preferences", response_model=schemas.PreferencesOut)
def put_preferences(data: schemas.PreferencesIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return service.set_prefs(db, user, data.share_with_scheduler, data.chat_enabled)


@router.delete("/my-data")
def delete_my_data(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Right to erase: removes this student's journal, chat, moods, signals and what was sent to other components."""
    return {"deleted": service.delete_my_data(db, user)}
