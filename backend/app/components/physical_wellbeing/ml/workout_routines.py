"""Structured, timed instructions for the curated Physical Wellbeing workouts."""

ROUTINES = {
    "ex_10_gentle_mobility": {"rounds": 1, "rest_seconds": 10, "warmup": "Easy breathing and posture check", "cooldown": "Relaxed breathing", "exercises": ["Shoulder rolls", "Supported side reaches", "Gentle neck turns", "Easy arm mobility", "Comfortable-range spinal twists"]},
    "ex_15_walk": {"rounds": 1, "rest_seconds": 0, "warmup": "Easy walking pace", "cooldown": "Slow walk and relaxed breathing", "exercises": ["Brisk campus walk", "Steady walk with relaxed shoulders", "Brisk walk with natural arm swing"]},
    "ex_15_dance": {"rounds": 2, "rest_seconds": 15, "warmup": "Easy side steps and shoulder rolls", "cooldown": "Slow steps and gentle breathing", "exercises": ["Simple salsa steps", "Side shuffles", "Arm reaches with side steps", "Gentle hip sways"]},
    "ex_15_jog": {"rounds": 4, "rest_seconds": 0, "warmup": "Easy walk", "cooldown": "Easy recovery walk", "exercises": ["Light jog", "Brisk recovery walk"]},
    "ex_15_1": {"rounds": 2, "rest_seconds": 20, "warmup": "March in place and shoulder rolls", "cooldown": "Slow march and easy breathing", "exercises": ["Step jacks", "Mountain climbers or standing knee drives", "High-knee march", "Shadow boxing"]},
    "ex_15_2": {"rounds": 1, "rest_seconds": 10, "warmup": "Seated posture reset", "cooldown": "Slow breathing with shoulders relaxed", "exercises": ["Thoracic spine twists", "Cat-cow flow", "Doorway chest opener", "Gentle neck release"]},
    "ex_15_3": {"rounds": 2, "rest_seconds": 15, "warmup": "Gentle standing march", "cooldown": "Easy breathing on your back or seated", "exercises": ["Glute bridges", "Bird-dogs", "Dead bugs", "Forearm plank from knees", "Seated torso rotations"]},
    "ex_20_walk": {"rounds": 4, "rest_seconds": 0, "warmup": "Easy walk", "cooldown": "Slow walk", "exercises": ["Brisk walk", "Fast arm-swing walk"]},
    "ex_20_zumba": {"rounds": 2, "rest_seconds": 15, "warmup": "Easy rhythm steps", "cooldown": "Slow side steps", "exercises": ["Merengue steps", "Cumbia shuffles", "Low-impact side reaches", "Hip rolls at a comfortable pace"]},
    "ex_20_jog": {"rounds": 4, "rest_seconds": 0, "warmup": "Easy walk", "cooldown": "Recovery walk", "exercises": ["Light jog", "Recovery walk"]},
    "ex_20_bands": {"rounds": 3, "rest_seconds": 20, "warmup": "Arm circles and easy shoulder mobility", "cooldown": "Gentle upper-body stretches", "exercises": ["Band pull-aparts", "Lateral band walks", "Standing band bicep curls", "Glute kickbacks"]},
    "ex_20_1": {"rounds": 3, "rest_seconds": 20, "warmup": "March in place and arm circles", "cooldown": "Easy walk and relaxed breathing", "exercises": ["Incline or knee push-ups", "Bodyweight hip hinges", "Wall sit or supported sit-to-stand", "Plank shoulder taps from knees", "March in place"]},
    "ex_20_2": {"rounds": 3, "rest_seconds": 15, "warmup": "Easy step jacks", "cooldown": "Slow steps and breathing", "exercises": ["Step jacks", "Standing oblique crunches", "Low-impact skater steps", "Butt kicks or heel curls", "Arm pulses"]},
    "ex_20_3": {"rounds": 2, "rest_seconds": 15, "warmup": "Easy breathing and tabletop position", "cooldown": "Resting pose with slow breaths", "exercises": ["Gentle sun-salutation flow", "Warrior pose sequence", "Hip-opening lunge stretch", "Cat-cow and spinal mobility"]},
    "ex_20_4": {"rounds": 3, "rest_seconds": 25, "warmup": "Arm circles and light shoulder mobility", "cooldown": "Gentle chest and shoulder stretches", "exercises": ["Dumbbell shoulder press", "Bicep curls", "Overhead triceps extensions", "Plank dumbbell drags or unloaded reach-throughs"]},
    "ex_30_1": {"rounds": 3, "rest_seconds": 15, "warmup": "March in place, arm circles, and easy hip hinges", "cooldown": "Slow walk and full-body relaxed stretches", "exercises": ["Push-ups or incline push-ups", "Glute bridges", "Step-backs", "Plank shoulder taps", "Arm circles", "Side plank, knees down if needed"]},
    "ex_30_2": {"rounds": 3, "rest_seconds": 20, "warmup": "Easy march and step jacks", "cooldown": "Slow walk and relaxed breathing", "exercises": ["Burpees or step-back burpees", "High knees or standing march", "Squat thrusts or hands-to-chair step-backs", "Bicycle crunches", "Mountain climbers or standing knee drives"]},
    "ex_30_3": {"rounds": 2, "rest_seconds": 15, "warmup": "Gentle breathing and pelvic tilts", "cooldown": "Child’s pose or a comfortable resting position", "exercises": ["90/90 hip transitions", "Supported pigeon stretch", "Child’s pose", "World’s greatest stretch, shortened range", "Gentle spinal waves"]},
    "ex_30_4": {"rounds": 4, "rest_seconds": 0, "warmup": "Easy campus walk", "cooldown": "Slow walk", "exercises": ["Brisk level walk", "Comfortable stair climb or level-walk alternative", "Steady recovery walk"]},
    "ex_30_zumba": {"rounds": 3, "rest_seconds": 15, "warmup": "Easy dance steps and shoulder rolls", "cooldown": "Slow side steps and breathing", "exercises": ["Salsa step interval", "Reggaeton side-step interval", "Bachata step interval", "Low-impact dance recovery"]},
    "ex_30_run": {"rounds": 4, "rest_seconds": 0, "warmup": "Easy walk", "cooldown": "Recovery walk", "exercises": ["Comfortable steady jog", "Easy recovery jog or walk"]},
    "ex_30_mat": {"rounds": 2, "rest_seconds": 15, "warmup": "Breathing and gentle pelvic tilts", "cooldown": "Resting position and slow breathing", "exercises": ["The Hundred, knees bent if needed", "Roll-ups or half roll-backs", "Single-leg stretches", "Swimming, small controlled range", "Side planks from knees"]},
    "ex_45_1": {"rounds": 3, "rest_seconds": 30, "warmup": "Easy cardio and unloaded squat/hinge practice", "cooldown": "Slow walk and comfortable stretches", "exercises": ["Goblet squat to a comfortable depth", "Dumbbell bench press", "Bent-over dumbbell row", "Reverse lunge or supported step-back", "Hollow hold or dead bug"]},
    "ex_45_knee_safe": {"rounds": 3, "rest_seconds": 30, "warmup": "Seated arm movements and shoulder mobility", "cooldown": "Gentle upper-body stretches", "exercises": ["Dumbbell bench press", "Seated overhead press", "Chest-supported dumbbell row", "Glute bridge hold", "Comfortable-range core plank"]},
    "ex_45_2": {"rounds": 4, "rest_seconds": 20, "warmup": "Easy march and step jacks", "cooldown": "Slow walk and relaxed breathing", "exercises": ["Low-impact step jacks", "Bodyweight hip hinges", "Standing knee drives", "Alternating step-backs", "Core brace or dead bug"]},
    "ex_45_3": {"rounds": 2, "rest_seconds": 20, "warmup": "Seated breathing and gentle joint circles", "cooldown": "Ten minutes of comfortable box breathing", "exercises": ["Gentle Hatha standing sequence", "Supported hip opener", "Comfortable hamstring stretch", "Restorative floor posture"]},
    "ex_60_1": {"rounds": 3, "rest_seconds": 45, "warmup": "Five minutes of easy cardio and mobility", "cooldown": "Five minutes of easy walking and stretches", "exercises": ["Goblet squat", "Dumbbell bench press", "Dumbbell row", "Hip hinge or Romanian deadlift with light weight", "Core exercise of choice"]},
    "ex_60_2": {"rounds": 5, "rest_seconds": 0, "warmup": "Easy walk or cycle", "cooldown": "Slow walk or cycle", "exercises": ["Comfortable Zone 2 jog or cycle", "Easy recovery pace"]},
}


def with_workout_routine(exercise: dict) -> dict:
    """Attach understandable steps and timing guidance to a curated workout."""
    routine = ROUTINES.get(exercise.get("id"))
    if not routine:
        return exercise
    result = dict(exercise)
    result["routine"] = {
        "rounds": routine["rounds"],
        "rest_seconds": routine["rest_seconds"],
        "warmup": {"name": routine["warmup"], "cue": "Move gently and prepare at a comfortable pace."},
        "exercises": [
            {"name": name, "cue": f"Work steadily on {name.lower()}; use the easier variation or pause if needed."}
            for name in routine["exercises"]
        ],
        "cooldown": {"name": routine["cooldown"], "cue": "Slow down, breathe comfortably, and stop if anything hurts."},
    }
    return result
