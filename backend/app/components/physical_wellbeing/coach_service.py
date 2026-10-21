"""Physical Wellbeing scoped chat and safe workout adaptation."""
import re

from app.components.physical_wellbeing.ml import recommender


def requested_workout(message: str, profile: dict) -> dict | None:
    text = message.lower()
    has_workout_target = any(term in text for term in ("workout", "exercise", "routine", "work out"))
    if not has_workout_target or is_workout_question(message):
        return None
    if text.lstrip().startswith(("should i ", "why should i ", "can i ", "what if i ", "is it okay to ")):
        return None
    # Mutate the plan only for explicit workout actions. The default for any
    # ambiguous or informational message is to answer without changing data.
    explicit_change = bool(re.search(
        r"\b(?:change|replace|switch|update|adjust)\s+(?:(?:my|today's|today’s|the)\s+)?(?:workout|exercise|routine)\b",
        text,
    ) or re.search(
        r"\b(?:give me|i want|can you give me|make me|create me|suggest me|recommend me)\b"
        r".{0,60}\b(?:workout|exercise|routine)\b",
        text,
    ) or re.search(r"\bmake\s+(?:my|today's|today’s)\s+(?:workout|exercise|routine)\b", text))
    if not explicit_change:
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


def is_meal_plan_question(message: str) -> bool:
    text = message.lower()
    return any(term in text for term in ("meal plan", "meals for today", "food for today", "what should i eat", "what can i eat", "today's meals", "todays meals"))


def is_workout_question(message: str) -> bool:
    text = message.lower()
    mentions_workout = any(term in text for term in ("workout", "exercise", "routine"))
    asks_about = text.lstrip().startswith(("what ", "what's", "what’s", "whats", "which ", "show me", "tell me what", "do i have", "is my "))
    return mentions_workout and asks_about


def fallback_reply(message: str, workout: dict | None, activity: dict, today_plan: dict | None = None, today_workout: dict | None = None) -> str:
    if workout and workout.get("unavailable"):
        return "I couldn’t find a workout that fits that request and your current safety settings. Try a little more time or ask for a gentle, bodyweight option."
    if workout:
        mins = workout.get("duration_mins", workout.get("minutes", ""))
        return "Done — I updated today’s plan to " + str(workout.get("name", "your new workout")) + " (" + str(mins) + " minutes). You can change it again whenever you like."
    if is_meal_plan_question(message):
        days = (today_plan or {}).get("days", [])
        meals = (days[0].get("meals") or {}) if days else {}
        if meals:
            labels = (("breakfast", "Breakfast"), ("lunch", "Lunch"), ("dinner", "Dinner"), ("snack", "Snack"))
            lines = ["Here’s your meal plan for today:"]
            for key, label in labels:
                items = meals.get(key) or []
                if items:
                    names = [str(item.get("name", "Meal")) for item in items[:2] if isinstance(item, dict)]
                    if names:
                        lines.append(f"• {label}: " + " or ".join(names))
            return "\n".join(lines)
        return "I couldn’t load today’s meal plan right now. Open Today’s Plan and try again in a moment."
    if is_workout_question(message):
        if today_workout:
            name = today_workout.get("name", "your planned workout")
            minutes = today_workout.get("duration_mins", today_workout.get("minutes"))
            detail = f" ({minutes} minutes)" if minutes else ""
            return f"Today’s workout is {name}{detail}. Ask me to change it if you need a different option."
        return "I couldn’t load today’s workout just now. Open Today’s Plan and try again in a moment."
    weekly = activity.get("weekly_totals", {})
    if any(term in message.lower() for term in ("this week", "progress", "how am i doing", "activity")):
        return (f"This week you’ve logged {weekly.get('exercise_minutes', 0)} minutes of exercise and "
                f"{weekly.get('steps', 0)} steps across {weekly.get('days_active', 0)} active days. "
                "Small, consistent sessions count — ask me to adjust today’s workout if your schedule has changed.")
    if any(term in message.lower() for term in ("what can you do", "how can you help", "what do you help", "what can i ask")):
        return ("I can help you understand today’s workout and meals, suggest a safe workout change, explain your "
                "activity and weekly progress, and guide you through habits, profile settings, and workout reminders. "
                "You can ask in your own words; I’ll treat it as a question unless you clearly ask me to change the plan.")
    text = message.lower()
    if any(term in text for term in ("reminder", "notification", "bell", "workout time")):
        return ("Set a workout reminder from Today’s Plan by choosing the day and your available start and end time. "
                "When it is due, the reminder appears in the app’s bell notifications. You can edit the time window anytime.")
    if any(term in text for term in ("habit", "streak")):
        return ("Open Habits in Physical Wellbeing to add a habit, mark it done each day, and see its streak. "
                "Your Progress page summarizes activity and plan check-ins separately.")
    if any(term in text for term in ("profile", "preference", "allerg", "equipment", "diet", "food")):
        return ("Open My Profile in Physical Wellbeing to update your goals, available workout time, equipment, "
                "diet and cuisine preferences, allergies, foods to avoid, and physical limitations. Your plan uses those preferences.")
    if any(term in text for term in ("adapt", "recommendation", "why did", "why is my workout", "exam")):
        return ("Your plan is personalized from your goals, available time, equipment, food preferences, and physical "
                "limitations. Recent workout check-ins and the exam-week setting can also affect recommendations. "
                "You can review preferences in My Profile and compare the baseline plan from Today’s Plan.")
    if any(term in text for term in ("pain", "injur", "hurt", "sore")):
        return ("Don’t exercise through pain. Stop the activity and seek advice from a qualified health professional, "
                "especially for a new injury or severe symptoms. You can record physical limitations in My Profile so recommendations can account for them.")
    return ("I can answer from your current plan and activity, including today’s meals and workout options. "
            "I don’t have enough information to answer that specific question yet. Try asking about meals, workouts, "
            "activity, habits, reminders, profile settings, or plan recommendations.")
