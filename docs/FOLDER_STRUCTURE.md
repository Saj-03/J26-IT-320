# Folder structure
(`__init__.py` files hidden)

```
ihusd/
├── backend/
│   ├── app/
│   │   ├── components/
│   │   │   ├── burnout/
│   │   │   │   ├── llm/
│   │   │   │   │   ├── chat_agent.py
│   │   │   │   │   └── prompts.py
│   │   │   │   ├── ml/
│   │   │   │   │   ├── deviation_detector.py
│   │   │   │   │   └── fusion.py
│   │   │   │   ├── nlp/
│   │   │   │   │   ├── emotion.py
│   │   │   │   │   └── sentiment.py
│   │   │   │   ├── models.py
│   │   │   │   ├── router.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── service.py
│   │   │   ├── career/
│   │   │   │   ├── ml/
│   │   │   │   │   ├── interview_eval.py
│   │   │   │   │   ├── recommender.py
│   │   │   │   │   ├── roadmap.py
│   │   │   │   │   └── skill_gap.py
│   │   │   │   ├── models.py
│   │   │   │   ├── router.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── service.py
│   │   │   ├── physical_wellbeing/
│   │   │   │   ├── ml/
│   │   │   │   │   └── recommender.py
│   │   │   │   ├── models.py
│   │   │   │   ├── router.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── service.py
│   │   │   └── scheduler/
│   │   │       ├── engine/
│   │   │       │   ├── attention_model.py
│   │   │       │   ├── constraint_scheduler.py
│   │   │       │   ├── gamification.py
│   │   │       │   └── stress_rules.py
│   │   │       ├── models.py
│   │   │       ├── router.py
│   │   │       ├── schemas.py
│   │   │       └── service.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── dependencies.py
│   │   │   └── security.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   └── session.py
│   │   ├── shared/
│   │   │   ├── auth/
│   │   │   │   ├── router.py
│   │   │   │   └── schemas.py
│   │   │   ├── integration/
│   │   │   │   ├── contracts.py
│   │   │   │   ├── mock_signals.py
│   │   │   │   ├── models.py
│   │   │   │   ├── router.py
│   │   │   │   └── validator.py
│   │   │   └── users/
│   │   │       └── models.py
│   │   └── main.py
│   ├── datasets/
│   │   ├── burnout/
│   │   │   └── README.md
│   │   ├── career/
│   │   │   └── careers.json
│   │   └── physical/
│   │       ├── exercises.json
│   │       └── meals.json
│   ├── ml_models/
│   │   └── .gitkeep
│   ├── ml_training/
│   │   ├── burnout/
│   │   │   └── tune_isolation_forest.py
│   │   ├── career/
│   │   │   └── evaluate_recommender.py
│   │   ├── physical_wellbeing/
│   │   │   └── train_adherence_xgb.py
│   │   ├── scheduler/
│   │   │   └── attention_analysis.py
│   │   └── README.md
│   ├── tests/
│   │   ├── test_burnout_fusion.py
│   │   ├── test_career_recommender.py
│   │   ├── test_integration_contracts.py
│   │   └── test_scheduler_rules.py
│   ├── .env.example
│   ├── Dockerfile
│   ├── pytest.ini
│   └── requirements.txt
├── docs/
│   ├── FOLDER_STRUCTURE.md
│   └── VIVA_GUIDE.md
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── burnout/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── ChatPage.jsx
│   │   │   │   │   ├── JournalPage.jsx
│   │   │   │   │   └── WellbeingHome.jsx
│   │   │   │   ├── README.md
│   │   │   │   ├── api.js
│   │   │   │   └── routes.jsx
│   │   │   ├── career/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── InterviewPage.jsx
│   │   │   │   │   ├── QuestionnairePage.jsx
│   │   │   │   │   ├── RecommendationsPage.jsx
│   │   │   │   │   └── RoadmapPage.jsx
│   │   │   │   ├── README.md
│   │   │   │   ├── api.js
│   │   │   │   └── routes.jsx
│   │   │   ├── physical-wellbeing/
│   │   │   │   ├── components/
│   │   │   │   │   ├── ActivityForm.jsx
│   │   │   │   │   └── PoseCoach.jsx
│   │   │   │   ├── pages/
│   │   │   │   │   ├── PhysicalHome.jsx
│   │   │   │   │   └── ProfilePage.jsx
│   │   │   │   ├── README.md
│   │   │   │   ├── api.js
│   │   │   │   └── routes.jsx
│   │   │   └── scheduler/
│   │   │       ├── components/
│   │   │       │   ├── AdaptationBanner.jsx
│   │   │       │   └── TaskForm.jsx
│   │   │       ├── pages/
│   │   │       │   ├── FocusTimerPage.jsx
│   │   │       │   └── PlannerPage.jsx
│   │   │       ├── README.md
│   │   │       ├── api.js
│   │   │       └── routes.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── shared/
│   │   │   ├── api/
│   │   │   │   └── client.js
│   │   │   ├── components/
│   │   │   │   ├── AppLayout.jsx
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── Notice.jsx
│   │   │   │   └── ProtectedRoute.jsx
│   │   │   ├── context/
│   │   │   │   └── AuthContext.jsx
│   │   │   ├── hooks/
│   │   │   │   └── useFetch.js
│   │   │   └── styles/
│   │   │       └── global.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore
├── README.md
└── docker-compose.yml
```
