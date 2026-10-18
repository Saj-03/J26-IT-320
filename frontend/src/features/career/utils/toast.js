// Tiny toast store for the career pages: toast.success("Saved"), toast.info(...), toast.error(...).
// CareerToaster (in CareerPage) shows them; each one disappears after a few seconds.
import { useSyncExternalStore } from "react";

let toasts = [];
let nextId = 1;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

function dismiss(id) {
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

function show(tone, message, { duration = 3200, emoji } = {}) {
  const id = nextId++;
  toasts = [...toasts.filter((x) => x.message !== message), { id, tone, message, emoji }].slice(-3); // max 3, no duplicates
  emit();
  setTimeout(() => dismiss(id), duration);
  return id;
}

export const toast = {
  success: (message, opts) => show("success", message, opts),
  info: (message, opts) => show("info", message, opts),
  error: (message, opts) => show("error", message, { duration: 5000, ...opts }),
  dismiss,
};

export function useToasts() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => toasts,
    () => toasts,
  );
}
