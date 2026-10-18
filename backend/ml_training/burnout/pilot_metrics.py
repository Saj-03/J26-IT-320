"""
Pilot metrics table from the platform logs (proposal Table 1). Run from backend/:  python ml_training/burnout/pilot_metrics.py
Only participants who gave research consent are included (use --all for development data). Prints counts and rates only.
Baseline 2 participants are the research_ids listed in BASELINE2_IDS (.env), e.g. BASELINE2_IDS=P-1a2b3c4d,P-5e6f7a8b
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import app.db.base  # noqa: F401,E402  (registers every model)
from app.db.session import SessionLocal  # noqa: E402
from app.shared.users.models import User  # noqa: E402
from app.components.burnout.metrics import participant_metrics, group_summary  # noqa: E402


def main():
    everyone = "--all" in sys.argv
    with SessionLocal() as db:
        users = db.query(User).all() if everyone else db.query(User).filter(User.research_consent.is_(True)).all()
        rows = [participant_metrics(db, u) for u in users]
    print(f"Participants: {len(rows)}  ({'all users' if everyone else 'research consent only'})\n")
    print(f"{'participant':<12}{'group':<11}{'chat/wk':>8}{'depth':>7}{'journal d/wk':>14}{'tips shown':>12}{'tried':>7}{'CTR':>6}")
    for r in rows:
        print(f"{r['research_id']:<12}{r['group']:<11}{r['chat_sessions_per_week']:>8}{str(r['turn_depth']):>7}"
              f"{r['journal_days_per_week']:>14}{r['tips_shown']:>12}{r['tips_tried']:>7}{str(r['tip_click_through']):>6}")
    print("\nBy group (mean per participant):")
    for g, v in group_summary(rows).items():
        print(f"  {g:<10} n={v['n']}  chat/wk={v['chat_sessions_per_week']}  depth={v['turn_depth']}  "
              f"journal d/wk={v['journal_days_per_week']}  tip CTR={v['tip_click_through']}")
    print("\nProposal targets: depth > 4 turns; journal > 40% of participants weekly; tip click-through > 40%.")


if __name__ == "__main__":
    main()
