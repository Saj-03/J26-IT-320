# IHUSD — Immersive Holistic Undergraduate Student Development (J26-IT-320)

One system, four research components, one shared database.

| Component | Owner | Backend folder | Frontend folder | API prefix |
|---|---|---|---|---|
| Career Readiness (ACRDS) | N.G.A.J. Yasarathna — IT23207240 | `backend/app/components/career` | `frontend/src/features/career` | `/api/career` |
| Physical Wellbeing | Nilukshika R — IT23316522 | `backend/app/components/physical_wellbeing` | `frontend/src/features/physical-wellbeing` | `/api/physical` |
| C3 Adaptive Scheduler | C.S.K.A.I.A. Kumara — IT23270206 | `backend/app/components/scheduler` | `frontend/src/features/scheduler` | `/api/scheduler` |
| C4 Burnout Prediction | K.P.S.M. Pinnawala — IT23201378 | `backend/app/components/burnout` | `frontend/src/features/burnout` | `/api/burnout` |
| Shared (auth, integration) | Whole team | `backend/app/shared` | `frontend/src/shared` | `/api/auth`, `/api/integration` |

## Run it

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # set DATABASE_URL=sqlite:///./ihusd.sqlite3 for a quick demo
uvicorn app.main:app --reload
```
Open http://localhost:8000/docs — every endpoint is testable there (good for viva demo).

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Open http://localhost:5173

**Tests**
```bash
cd backend && pytest
```

**Everything with Docker**
```bash
docker compose up --build
```

See `docs/VIVA_GUIDE.md` for the folder-by-folder explanation.
