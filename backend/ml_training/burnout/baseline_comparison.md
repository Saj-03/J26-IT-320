# Behaviour baseline: synthetic comparison (simulated students, not real data)

500 simulated students per cell, each with their own normal; a strained week moves 2 of 4 features by d of the student's own SD.
Cells show AUC / share of strained weeks caught at 10% false alarms.

## Strain size d = 2.5 (of the student's own SD)

| Method | 3 weeks of history | 4 weeks of history | 5 weeks of history | 7 weeks of history |
|---|---|---|---|---|
| Per-student z-score (ours) | 0.89 / 70% | 0.90 / 72% | 0.90 / 71% | 0.90 / 74% |
| Isolation Forest per student | 0.63 / 16% | 0.64 / 19% | 0.70 / 28% | 0.77 / 43% |
| Plain rule (change from own average) | 0.79 / 47% | 0.81 / 50% | 0.80 / 50% | 0.82 / 50% |
| Population z-score (not personal) | 0.75 / 50% | 0.75 / 48% | 0.74 / 47% | 0.72 / 45% |

## Strain size d = 4.0 (of the student's own SD)

| Method | 3 weeks of history | 4 weeks of history | 5 weeks of history | 7 weeks of history |
|---|---|---|---|---|
| Per-student z-score (ours) | 0.98 / 96% | 0.99 / 96% | 0.99 / 98% | 0.99 / 98% |
| Isolation Forest per student | 0.61 / 16% | 0.67 / 27% | 0.72 / 26% | 0.78 / 33% |
| Plain rule (change from own average) | 0.90 / 70% | 0.91 / 73% | 0.93 / 80% | 0.92 / 76% |
| Population z-score (not personal) | 0.90 / 76% | 0.88 / 76% | 0.89 / 78% | 0.87 / 74% |

Reading: a method that knows each student's own normal beats one that compares with everyone. Isolation Forest needs more
history than a student has; the simple z-score is stable from 3 weeks and also names the features that moved.
