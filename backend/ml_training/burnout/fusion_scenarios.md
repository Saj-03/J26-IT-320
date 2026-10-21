# Fusion layer: scenario evaluation (scripted students, not real data)

## 1. Journal text check (VADER, flagged when risk > 0.6)

| Journal line | Strained? | VADER | Flagged |
|---|---|---|---|
| I am so exhausted and I cannot cope with these deadlines anymore. | yes | -0.50 | yes |
| Everything feels overwhelming, I keep falling behind and I am stressed all the time. | yes | -0.46 | yes |
| I did not sleep again and I feel hopeless about this semester. | yes | -0.46 | yes |
| I am dreading tomorrow, I feel like I am failing every module. | yes | -0.64 | yes |
| Too many assignments, I am anxious and I cannot switch off. | yes | -0.25 | no |
| I am tired of everything and nothing I do is good enough. | yes | +0.00 | no |
| Good day, finished my tasks and still had time to relax. | no | +0.70 | no |
| Feeling fine, a bit busy but manageable. | no | +0.17 | no |
| Had a great lab session and went for a walk with friends. | no | +0.80 | no |
| Submitted the report early, quite proud of myself. | no | +0.53 | no |
| Nothing special today, just lectures and some reading. | no | -0.31 | no |
| Not too bad today, I managed to study for a few hours. | no | +0.43 | no |
| I am fine, just a little tired after the exam. | no | -0.20 | no |
| Deadlines are tough this week but I have a plan and I feel okay. | no | +0.27 | no |

Strained lines caught: 4/6 (recall 67%); okay lines wrongly flagged: 0/8; precision 100%.
Small hand-written set: it shows the behaviour of the method, not its accuracy on real students.

## 2. Scenarios and ablation

Level reached by each variant. A tick means it matches what a sensible person would expect.

| Scenario | Expected | mood only | behaviour only | text only | fused |
|---|---|---|---|---|---|
| S1 Steady week | LOW | LOW ✔ (0.17) | LOW ✔ (0.00) | LOW ✔ (0.00) | LOW ✔ (0.04) |
| S2 Exam crunch, all signals | HIGH | MODERATE ✘ (0.92) | MODERATE ✘ (1.00) | MODERATE ✘ (0.71) | HIGH ✔ (0.89) |
| S3 Quiet struggle (hidden from the Scheduler) | MODERATE+ | MODERATE ✔ (0.83) | LOW ✘ (0.00) | MODERATE ✔ (0.71) | MODERATE ✔ (0.43) |
| S4 Busy but coping | NOT HIGH | LOW ✔ (0.33) | MODERATE ✔ (1.00) | LOW ✔ (0.00) | MODERATE ✔ (0.52) |
| S5 Smiling but overloaded | NOT HIGH | MODERATE ✔ (0.50) | MODERATE ✔ (1.00) | LOW ✔ (0.00) | MODERATE ✔ (0.56) |
| S6 New student, low mood only | NOT HIGH | MODERATE ✔ (0.92) | LOW ✔ (0.00) | LOW ✔ (0.00) | MODERATE ✔ (0.92) |
| S7 Bounced back | LOW | LOW ✔ (0.08) | LOW ✔ (0.00) | LOW ✔ (0.00) | LOW ✔ (0.02) |

| Variant | Matches expected | Wrongly HIGH |
|---|---|---|
| mood only | 6/7 | 0 |
| behaviour only | 5/7 | 0 |
| text only | 6/7 | 0 |
| fused | 7/7 | 0 |

Rules built in: a single signal can never reach HIGH, missing signals are skipped, weights are renormalised.
Weights and thresholds are initial heuristics; they are to be reviewed against pilot data.
