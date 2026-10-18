import { useAuth } from "../context/AuthContext";
import { student as demo } from "../lib/data";
import useProgress from "../../features/scheduler/hooks/useProgress";
import { levelName } from "../../features/scheduler/lib";

// The logged-in user's identity on top of the demo profile.
// Level / XP / streak come from the scheduler API (GET /scheduler/progress).
// University / degree / year stay sample values until the backend exposes them.
export default function useStudent() {
  const { user } = useAuth();
  const progress = useProgress(user?.id);
  if (!user) return demo;
  const fullName = user.full_name || demo.fullName;
  const level = progress?.level ?? 1;
  const xp = progress?.total_xp ?? 0;
  return {
    ...demo, fullName, name: fullName.split(" ")[0], email: user.email, avatar: null,
    level, levelName: levelName(level), xp,
    xpToNext: xp + (progress?.xp_to_next_level ?? 200),   // XP total needed for the next level
    streak: progress?.streak.current ?? 0,
    freezeTokens: progress?.streak.freeze_left_this_week ?? 0,
  };
}
