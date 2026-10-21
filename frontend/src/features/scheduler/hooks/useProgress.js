// XP, level, streak and badges from GET /scheduler/progress (Module G).
// One shared copy for the whole app: the sidebar, header and pages all read the same numbers,
// and it reloads when a focus session ends or a task is finished (api.js sends "scheduler:progress").
import { useEffect, useState } from "react";
import { getProgress } from "../api";

let cached = null;            // { userId, data } - last answer from the server
let loading = null;           // running request (so 5 components = 1 request)
let currentUser = null;
const listeners = new Set();

function load() {
  if (!loading && currentUser) {
    const userId = currentUser;
    loading = getProgress()
      .then((data) => { cached = { userId, data }; listeners.forEach((fn) => fn(data)); })
      .catch(() => {})                                   // keep the old numbers if it fails
      .finally(() => { loading = null; });
  }
  return loading;
}

if (typeof window !== "undefined") window.addEventListener("scheduler:progress", load);

// userId: the logged-in student (another student's numbers are never shown after a re-login)
export default function useProgress(userId) {
  const mine = cached?.userId === userId ? cached.data : null;
  const [progress, setProgress] = useState(mine);
  useEffect(() => {
    if (!userId) return undefined;
    currentUser = userId;
    setProgress(cached?.userId === userId ? cached.data : null);
    listeners.add(setProgress);
    load();                                              // fresh numbers each time a page opens
    return () => listeners.delete(setProgress);
  }, [userId]);
  return userId ? progress : null;                       // null until the first answer
}
