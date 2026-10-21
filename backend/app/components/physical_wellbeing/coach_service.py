"""Physical Wellbeing scoped chat and safe workout adaptation."""
import re

from app.components.physical_wellbeing.ml import recommender


def requested_workout(message: str, profile: dict) -> dict | None:
    text = message.lower()
    change_intent = any(term in text for term in (
        "change", "switch", "replace", "give me", "make it", "i want", "can you make", "something",
        "instead", "shorter", "easier", "light", "quick",
    )) or (any(term in text for term in ("workout", "exercise", "routine")) and
          any(term in text for term in ("today", "small", "short", "quick", "easy", "light", "10 ", "15 ", "20 ")))
    if not change_intent:
        return None
    match = re.search(r"\b(\d{1,3})\s*(?:minutes?|mins?)\b", text)
    requested_minutes = int(match.group(1)) if match else None
    light = any(word in text for word in ("light", "easy", "gentle", "small", "short", "quick", "low impact", "stretch"))
    max_minutes = min(requested_minutes or (15 if light else int(profile.get("available_minutes", 20))), 120)
    no_equipment = any(word in text for word in ("no equipment", "without equipment", "bodyweight", "at home"))
    movement = "mobility" if any(word in text for word in ("stretch", "mobility", "yoga")) else None
    candidates = recommender.get_tailored_exercises_for_profile(profile)
    if isinstance(candidates, dict):
        candidates = candidates.get("exercises", [])
    choices = [item for item in candidates if isinstance(item, dict) and not item.get("limitation_warning")]
    choices = [item for item in choices if int(item.get("duration_mins", item.get("minutes", 999))) <= max_minutes]
    if light:
        choices = [item for item in choices if int(item.get("intensity_level", 3)) <= 2]
    if movement:
        choices = [item for item in choices if movement in (str(item.get("primary_goal", "")).lower() + " " + str(item.get("name", "")).lower())]
    if no_equipment:
        choices = [item for item in choices if any(term in str(item.get("equipment", "")).lower() for term in ("bodyweight", "home", "none"))]
    if not choices:
        return {"unavailable": True, "requested_minutes": requested_minutes}
    return min(choices, key=lambda item: (abs(int(item.get("duration_mins", item.get("minutes", max_minutes))) - max_minutes), int(item.get("intensity_level", 1))))


def fallback_reply(message: str, workout: dict | None, activity: dict) -> str:
    if workout and workout.get("unavailable"):
        return "I couldn’t find a workout that fits that request and your current safety settings. Try a little more time or ask for a gentle, bodyweight option."
    if workout:
        mins = workout.get("duration_mins", workout.get("minutes", ""))
        return "Done — I updated today’s plan to " + str(workout.get("name", "your new workout")) + " (" + str(mins) + " minutes). You can change it again whenever you like."
    weekly = activity.get("weekly_totals", {})
    if any(term in message.lower() for term in ("this week", "progress", "how am i doing", "activity")):
        return (f"This week you’ve logged {weekly.get('exercise_minutes', 0)} minutes of exercise and "
                f"{weekly.get('steps', 0)} steps across {weekly.get('days_active', 0)} active days. "
                "Small, consistent sessions count — ask me to adjust today’s workout if your schedule has changed.")
    return ("I can help with workouts, movement, meals, habits, and your Physical Wellbeing plan. "
            "For example, ask for a 10-minute gentle workout, a no-equipment option, or a change to today’s plan.")
