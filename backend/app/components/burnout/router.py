from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.components.burnout import schemas, service
from app.components.burnout.models import JournalEntry, ChatMessage, MoodTap
from app.components.burnout.nlp.sentiment import sentiment
from app.components.burnout.nlp.emotion import emotion
from app.components.burnout.llm import prompts, chat_agent
from app.shared.integration.validator import record

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
    db.add(ChatMessage(user_id=user.id, role="user", content=data.message, sentiment=sentiment(data.message)))
    db.commit()
    history = [{"role": m.role, "content": m.content} for m in
               db.query(ChatMessage).filter_by(user_id=user.id).order_by(ChatMessage.created_at).all()[-10:]]
    ctx = {"deadlines_next_7_days": 3, "completion_rate": 0.6, "deviation": "slightly lower activity"} \
        if data.context_grounded else None   # TODO: read real values from C3 signal
    text = await chat_agent.reply(prompts.build_system_prompt(ctx), history)
    db.add(ChatMessage(user_id=user.id, role="assistant", content=text)); db.commit()
    return {"reply": text}


@router.post("/signal/compute")
def compute(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Run fusion and publish the RiskSignal to the Scheduler (C3)."""
    sig = service.compute_signal(db, user)
    risk = service.to_risk_signal(sig, user.research_id)
    record(db, "RISK", risk, "ACCEPTED")
    return {"risk_level": sig.risk_level, "risk_score": sig.risk_score, "inputs": sig.inputs,
            "note": "This is not a diagnosis."}
