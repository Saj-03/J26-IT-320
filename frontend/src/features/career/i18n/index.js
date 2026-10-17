// Language support for the career pages: English (default), Sinhala and Tamil.
//
// The English text itself is the translation key: t("Start survey") returns the Sinhala or
// Tamil version when one exists, otherwise the English text - so a missing translation never
// breaks a page. Survey answer values are translated the same way for display only; the
// English value is still what is saved and sent to the trained model.
import { useSyncExternalStore } from "react";
import si from "./si";
import ta from "./ta";

export const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "si", label: "සිංහල", short: "සිං" },
  { code: "ta", label: "தமிழ்", short: "தமி" },
];
const DICTIONARIES = { si, ta };
const STORAGE_KEY = "acrds.lang";
const listeners = new Set();

const stored = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === value) ? value : "en";
  } catch {
    return "en";
  }
};
let current = stored();

export const getLanguage = () => current;

/** Change the language for this browser; pages re-render through useLanguage(). */
export function setLanguage(code) {
  if (!LANGUAGES.some((l) => l.code === code) || code === current) return;
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage unavailable - the choice still applies until the page is reloaded */
  }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Current language code; re-renders the component when it changes. */
export const useLanguage = () => useSyncExternalStore(subscribe, getLanguage, getLanguage);

/** Translate English UI text. `{name}` placeholders are filled from `values`. */
export function t(text, values) {
  if (text == null) return text;
  const translated = (current !== "en" && DICTIONARIES[current]?.[text]) || text;
  return values ? translated.replace(/\{(\w+)\}/g, (m, key) => (key in values ? values[key] : m)) : translated;
}

/** Font stack that renders Sinhala and Tamil script well (Windows: Nirmala UI). */
export const SCRIPT_FONT = '"Inter", "Nirmala UI", "Noto Sans Sinhala", "Noto Sans Tamil", "Iskoola Pota", "Latha", system-ui, sans-serif';
