import { useAuth } from "../context/AuthContext";
import { student as demo } from "../lib/data";

// The logged-in user's identity on top of the demo profile.
// Level / XP / streak stay sample values until the backend exposes them.
export default function useStudent() {
  const { user } = useAuth();
  if (!user) return demo;
  const fullName = user.full_name || demo.fullName;
  return { ...demo, fullName, name: fullName.split(" ")[0], email: user.email, avatar: null };
}
