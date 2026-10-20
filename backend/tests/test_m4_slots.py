"""M4 slot rules: day / time / duration / deadline in Sinhala, Singlish and English."""
from datetime import date

import pytest

from ml_training.scheduler.m4_slots import extract

TODAY = date(2026, 10, 19)                 # Monday
TOMORROW, FRIDAY = date(2026, 10, 20), date(2026, 10, 23)

CASES = [
    # --- Sinhala ---
    ("හෙට 8 ඉඳන් 10 SE lecture",                 dict(date=TOMORROW, start="08:00", end="10:00")),
    ("ඊට පස්සේ 2 ඉඳන් 6 වෙනකම් job",             dict(start="14:00", end="18:00", after_previous=True)),
    ("හෙට උදේ අටට lecture එකක් තියෙනවා",         dict(date=TOMORROW, start="08:00")),
    ("රෑ 9ට notes කියවන්න",                     dict(start="21:00")),
    ("හවස 4ට gym",                              dict(start="16:00")),
    ("අට හමාරට class",                          dict(start="08:30")),
    ("ML assignment එක සිකුරාදා වෙනකොට ඉවර කරන්න", dict(deadline=FRIDAY, date=None)),
    ("පැය 3ක් විතර යයි",                         dict(duration_minutes=180, start=None)),
    ("පැය තුනක් යනවා",                           dict(duration_minutes=180)),
    ("පැය භාගයක් ඇති",                           dict(duration_minutes=30)),
    ("පැය එකහමාරක්",                             dict(duration_minutes=90)),
    ("පැය 2යි විනාඩි 30",                        dict(duration_minutes=150)),
    ("SE එකට යන්න ඕනේ",                          dict(start=None)),          # "එකට" is not "at 1"
    ("ලබන සඳුදා meeting",                        dict(date=date(2026, 10, 26))),
    ("අද රෑ revision",                           dict(date=TODAY, start=None)),
    # --- Singlish ---
    ("heta 2 idan 6 wenakam job",               dict(date=TOMORROW, start="14:00", end="18:00")),
    ("heta ude 8ta lecture",                    dict(date=TOMORROW, start="08:00")),
    ("re 9ta notes kiyawanna",                  dict(start="21:00")),
    ("ML assignment sikurada submit, paya 3",   dict(deadline=FRIDAY, duration_minutes=180)),
    ("eeta passe DBMS notes",                   dict(after_previous=True)),
    ("SE eka 8ta",                              dict(start="08:00")),
    ("SE ekata yanna",                          dict(start=None)),
    ("winadi 45k",                              dict(duration_minutes=45)),
    ("anidda hawasa 5ta",                       dict(date=date(2026, 10, 21), start="17:00")),
    # --- English ---
    ("Tomorrow gym at 7pm",                     dict(date=TOMORROW, start="19:00")),
    ("wake me up at five am",                   dict(start="05:00")),
    ("meeting from 10 to 2",                    dict(start="10:00", end="14:00")),
    ("finish the report by friday, about 3 hours", dict(deadline=FRIDAY, duration_minutes=180)),
    ("lunch with mum at noon",                  dict(start="12:00")),
    ("standup at 9:30",                         dict(start="09:30")),
    ("call at half past seven",                 dict(start="07:30")),
    ("read chapter 5 for 45 minutes",           dict(start=None, duration_minutes=45)),
    ("next friday the exam",                    dict(date=date(2026, 10, 23))),
    ("study 2h tonight",                        dict(date=TODAY, duration_minutes=120)),
    ("lab 1-3 on wednesday",                    dict(date=date(2026, 10, 21), start="13:00", end="15:00")),
    # --- bugs found on real MASSIVE sentences ---
    ("i am unavailable from four to six in the evening", dict(start="16:00", end="18:00")),   # "am" = "I am"
    ("meetings from nine to five p. m.",        dict(start="09:00", end="17:00")),
    ("between two and four pm",                 dict(start="14:00", end="16:00")),
    ("set the alarm for six",                   dict(start="18:00")),
    ("wake me at five o'clock in the morning",  dict(start="05:00")),
    # --- added to reach 80%+ on MASSIVE ---
    ("meeting at two thirty p.m.",              dict(start="14:30")),
    ("alarm eight hundred am",                  dict(start="08:00")),
    ("train at sixteen fifteen",                dict(start="16:15")),
    ("remind me in two hours",                  dict(in_minutes=120, duration_minutes=None)),
    ("call mum 30 minutes from now",            dict(in_minutes=30)),
    ("study for forty five minutes",            dict(duration_minutes=45, in_minutes=None)),
]


@pytest.mark.parametrize("text,expected", CASES, ids=[c[0][:30] for c in CASES])
def test_slots(text, expected):
    s = extract(text, TODAY)
    for key, value in expected.items():
        assert getattr(s, key) == value, f"{key}: got {getattr(s, key)!r}, want {value!r} ({s.found})"


def test_same_weekday_means_today_and_next_means_next_week():
    assert extract("sanduda lecture", TODAY).date == TODAY
    assert extract("next monday lecture", TODAY).date == date(2026, 10, 26)
