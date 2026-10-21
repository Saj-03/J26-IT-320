// Journal look: typography, page paper colour, texture ruling, and custom journal title
import { useEffect, useState } from "react";

export const FONTS = [
  { id: "serif", label: "Warm Editorial", css: "Fraunces, Georgia, serif" },
  { id: "hand", label: "Handwritten", css: "Caveat, 'Segoe Print', cursive" },
  { id: "clean", label: "Clean Sans", css: "Inter, system-ui, sans-serif" },
  { id: "type", label: "Typewriter", css: "'Courier New', Courier, monospace" },
];

export const PAGES = [
  { id: "cream", label: "Warm Cream", color: "#FFFBF0", border: "#F1EEE2", ribbon: "#2E9C88" },
  { id: "sage", label: "Calm Sage", color: "#EEF5EC", border: "#D8EAD3", ribbon: "#2E9C88" },
  { id: "blush", label: "Soft Blush", color: "#FDF4F4", border: "#F5DEDE", ribbon: "#D97777" },
  { id: "sky", label: "Clear Sky", color: "#EDF4FB", border: "#D8E7F6", ribbon: "#4E82B4" },
  { id: "lilac", label: "Muted Lilac", color: "#F5F0FD", border: "#E4DBF7", ribbon: "#7F67BE" },
];

export const TEXTURES = [
  { id: "lined", label: "Ruled Notebook" },
  { id: "dots", label: "Bullet Dots" },
  { id: "plain", label: "Clean Plain" },
];

const KEY = "thriveu.journal.style";
const DEFAULT = { font: "serif", page: "cream", texture: "lined", journalTitle: "" };

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export function useJournalStyle() {
  const [style, setStyle] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(style));
    } catch {
      /* private mode: ignore */
    }
  }, [style]);

  const font = FONTS.find((f) => f.id === style.font) || FONTS[0];
  const page = PAGES.find((p) => p.id === style.page) || PAGES[0];
  const texture = style.texture || (style.lined ? "lined" : "plain");

  return {
    style,
    setStyle,
    fontFamily: font.css,
    pageColor: page.color,
    pageBorder: page.border,
    ribbonColor: page.ribbon,
    texture,
    lined: texture === "lined",
    journalTitle: style.journalTitle || "",
    setJournalTitle: (title) => setStyle((prev) => ({ ...prev, journalTitle: title })),
  };
}
