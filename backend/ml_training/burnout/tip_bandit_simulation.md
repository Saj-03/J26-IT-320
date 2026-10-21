# Tip bandit: simulation (simulated students, not real data)

400 simulated students per row. Cells: share of tips the student tries, mean +- 95% interval over students.

## Students differ in what they try (the case the learner is for)

| Tips seen per student | Rules (today) | Random | Learned (bandit) | Oracle (ceiling) | Learned, last half |
|---|---|---|---|---|---|
| 20 | 42% +-2% | 40% +-1% | 45% +-2% | 60% +-2% | 47% +-2% |
| 40 | 42% +-1% | 40% +-1% | 48% +-1% | 60% +-1% | 50% +-2% |

## Control: the rules' default is already best for everyone

| Tips seen per student | Rules (today) | Random | Learned (bandit) | Oracle (ceiling) | Learned, last half |
|---|---|---|---|---|---|
| 20 | 60% +-1% | 52% +-1% | 54% +-1% | 60% +-1% | 54% +-2% |
| 40 | 60% +-1% | 52% +-1% | 54% +-1% | 60% +-1% | 55% +-1% |

Reading: where students differ, learning which category each student tries beats the fixed rules, and the gain grows with the
number of tips seen. In the control it costs a little (exploration) and never needs the student to answer anything extra.
Learning is slow because a student sees few tips, which is why the prior is shared. Real students may behave differently: the
pilot (learned vs rule-only, tried / shown) is the real test.
