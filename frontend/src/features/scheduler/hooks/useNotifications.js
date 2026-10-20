// Notifications from GET /scheduler/notifications (FR-11), shared by the header bell and the page.
// Reloads when the page changes and every 2 minutes, so the bell count stays current.
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../../shared/api/client";

const REFRESH_MS = 2 * 60 * 1000;

export default function useNotifications() {
  const location = useLocation();
  const [data, setData] = useState({ items: [], unread: 0, loaded: false });

  const reload = useCallback(() => {
    api.get("/scheduler/notifications")
      .then((r) => setData({ ...r.data, loaded: true }))
      .catch(() => setData((d) => ({ ...d, loaded: true })));
  }, []);

  useEffect(reload, [location.pathname, reload]);
  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const markSeen = () => api.post("/scheduler/notifications/seen").then(reload).catch(() => {});
  return { ...data, reload, markSeen };
}

// "5 min ago", "in 2 h", "yesterday" for a UTC time from the API
export function relativeTime(iso) {
  const ms = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`) - Date.now();
  const mins = Math.round(ms / 60000);
  const abs = Math.abs(mins);
  const say = (n, unit) => (mins >= 0 ? `in ${n} ${unit}` : `${n} ${unit} ago`);
  if (abs < 1) return "just now";
  if (abs < 60) return say(abs, "min");
  if (abs < 24 * 60) return say(Math.round(abs / 60), "h");
  if (abs < 48 * 60) return mins < 0 ? "yesterday" : "tomorrow";
  return say(Math.round(abs / 1440), "days");
}
