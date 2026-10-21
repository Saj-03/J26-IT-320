// Journal look: font and page colour, remembered in this browser only (never sent to the server).
import { useEffect, useState } from "react";

export const FONTS = [
  { id: "clean", label: "Clean", css: "inherit" },
  { id: "serif", label: "Serif", css: "Georgia, 'Times New Roman', serif" },
  { id: "hand", label: "Handwritten", css: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive" },
  { id: "type", label: "Typewriter", css: "'Courier New', Courier, monospace" },
];
export const PAGES = [
  { id: "cream", label: "Cream", color: "#FBF7F0" },
  { id: "sage", label: "Sage", color: "#EEF5EC" },
  { id: "blush", label: "Blush", color: "#FBEFEF" },
  { id: "sky", label: "Sky", color: "#EDF4FB" },
  { id: "lilac", label: "Lilac", color: "#F3EFFB" },
];
const KEY = "thriveu.journal.style";
const DEFAULT = { font: "clean", page: "cream" };

function read() {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULT; }
}

export function useJournalStyle() {
  const [style, setStyle] = useState(read);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(style)); } catch { /* private mode: ignore */ } }, [style]);
  const font = FONTS.find((f) => f.id === style.font) || FONTS[0];
  const page = PAGES.find((p) => p.id === style.page) || PAGES[0];
  return { style, setStyle, fontFamily: font.css, pageColor: page.color };
}
