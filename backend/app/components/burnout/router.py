from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

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
    return {"sentiment": e.sentiment, "emotion": e.emotion}


@router.post("/mood")
def mood(data: schemas.MoodIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.add(MoodTap(user_id=user.id, mood=data.mood)); db.commit()
    return {"ok": True}


@router.post("/chat")
async def chat(data: schemas.ChatIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
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
            text = await chat_agent.reply(prompts.build_system_prompt(ctx), history)
        except Exception:            # never crash the endpoint on an LLM/network error
            text = prompts.FALLBACK_REPLY

    db.add(ChatMessage(user_id=user.id, role="assistant", content=text)); db.commit()
    return {"reply": text, "crisis_flag": crisis}


@router.post("/signal/compute", response_model=schemas.SignalOut)
def compute(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Run fusion; log the RiskSignal (Scheduler) and RecoverySignal (Physical Wellbeing)."""
    return service.to_out(service.publish(db, user))


@router.get("/signal/summary", response_model=schemas.SummaryOut)
def signal_summary(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Read-only: latest stored signal + recent scores for the dashboard."""
    return service.summary(db, user)
