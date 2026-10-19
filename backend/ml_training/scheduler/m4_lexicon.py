"""
M4 (voice planner) - word tables for Sinhala, Singlish (Sinhala written in English letters) and English.

Used by m4_slots.py to find the day, time, duration and deadline in what a student says.
Every table maps the words a student may use -> one meaning. Add new spellings here, not in the rules.

Notes:
  * Sinhala suffixes are handled by the rules (e.g. "අට" + "ට" = "අටට" = at 8, "සිකුරාදා" + "ට").
  * Singlish has many spellings ("oni", "one", "ona"); the common ones are listed.
"""

# --- numbers -------------------------------------------------------------
NUMBER_WORDS = {
    # Sinhala
    "එක": 1, "දෙක": 2, "තුන": 3, "හතර": 4, "පහ": 5, "හය": 6, "හත": 7, "අට": 8,
    "නවය": 9, "නමය": 9, "දහය": 10, "එකොළහ": 11, "දොළහ": 12,
    # Singlish
    "eka": 1, "deka": 2, "thuna": 3, "tuna": 3, "hathara": 4, "hatara": 4, "paha": 5, "haya": 6,
    "hatha": 7, "hata": 7, "ata": 8, "nawaya": 9, "namaya": 9, "dahaya": 10, "ekolaha": 11, "dolaha": 12,
    # English
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}
# English 13-59 (minutes, 24 h clock "sixteen fifteen", durations "forty five minutes")
TEENS = {"thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17,
         "eighteen": 18, "nineteen": 19}
TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50}
UNITS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9}
RELATIVE_TIME = ("in", "after", "within")              # "in 2 hours" = 2 hours from now
HALF_WORDS = ("හමාර", "hamara", "hamare")          # "අට හමාරට" = 8:30, "එකහමාරක්" = 1.5

# --- days ----------------------------------------------------------------
RELATIVE_DAYS = {
    "අද": 0, "ada": 0, "today": 0, "tonight": 0,
    "හෙට": 1, "heta": 1, "tomorrow": 1, "tmrw": 1, "tmr": 1,
    "අනිද්දා": 2, "anidda": 2, "day after tomorrow": 2,
}
WEEKDAYS = {                                          # 0 = Monday
    "සඳුදා": 0, "sanduda": 0, "monday": 0, "mon": 0,
    "අඟහරුවාදා": 1, "angaharuwada": 1, "angaharuwaada": 1, "tuesday": 1, "tue": 1, "tues": 1,
    "බදාදා": 2, "badada": 2, "wednesday": 2, "wed": 2,
    "බ්‍රහස්පතින්දා": 3, "brahaspathinda": 3, "brahaspatinda": 3, "thursday": 3, "thu": 3, "thurs": 3,
    "සිකුරාදා": 4, "sikurada": 4, "friday": 4, "fri": 4,
    "සෙනසුරාදා": 5, "senasurada": 5, "saturday": 5,
    "ඉරිදා": 6, "irida": 6, "sunday": 6,          # no "sat" / "sun": ordinary English words
}
NEXT_WORDS = ("ලබන", "labana", "next")              # "ලබන සඳුදා" = Monday of next week

# --- part of the day (sets AM / PM). "am" / "pm" are NOT here: "I am busy" is not the morning -----
PART_OF_DAY = {
    "උදේ": "morning", "ude": "morning", "udeta": "morning", "morning": "morning",
    "දවල්": "afternoon", "dawal": "afternoon", "dawalta": "afternoon", "afternoon": "afternoon", "noon": "afternoon",
    "හවස": "evening", "hawasa": "evening", "hawas": "evening", "evening": "evening",
    "රෑ": "night", "ra": "night", "re": "night", "rae": "night", "reta": "night", "night": "night", "tonight": "night",
}

# --- durations ------------------------------------------------------------
HOUR_WORDS = ("පැය", "paya", "peya", "hour", "hours", "hr", "hrs", "h")
MINUTE_WORDS = ("විනාඩි", "winadi", "vinadi", "minute", "minutes", "min", "mins", "m")
ONE_HOUR_WORDS = ("පැයක්", "payak", "peyak", "an hour", "one hour")
HALF_HOUR_WORDS = ("පැය භාගයක්", "paya bagayak", "paya bhagayak", "half an hour", "half hour", "30 mins")

# --- connectors -----------------------------------------------------------
RANGE_FROM = ("ඉඳන්", "ඉදන්", "සිට", "idan", "indan", "sita", "to", "until", "till", "-")
RANGE_TO = ("වෙනකම්", "වෙනකන්", "දක්වා", "wenakam", "wenakan", "dakwa")
DEADLINE_WORDS = ("වෙනකොට", "කලින්", "ඉවර කරන්න", "submit", "due", "deadline", "by", "before",
                  "wenakota", "kalin", "iwara karanna")
WAKE_WORDS = ("wake", "get up", "getting up", "නැගිටින්න", "නැගිටිනවා", "nagitinna", "nagitinawa")   # -> morning
AFTER_WORDS = ("ඊට පස්සේ", "ඊට පසු", "eeta passe", "ita passe", "ita pasu", "after that", "and then", "then")
