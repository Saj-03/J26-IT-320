// ACRDS colour palette - applied to the career pages only, so the shared
// app theme (used by other components) is not changed.
export const PALETTE = {
  teal: "#9ADBCC",
  mint: "#C7F2D1",
  lime: "#E3FFD6",
  cream: "#FFFBF0",
  sky: "#D0F2F7",
  periwinkle: "#9EB2DB",
};

// Darker tones of the same hues for text, icons and the progress ring,
// so content stays readable on the light pastel backgrounds.
export const INK = {
  teal: "#1F5F53",
  periwinkle: "#34477A",
  ring: "#5DBFA9",
};

// Tailwind class sets (full literal strings so Tailwind can detect them).
export const ui = {
  page: "rounded-4xl bg-gradient-to-br from-[#E3FFD6] via-[#FFFBF0] to-[#D0F2F7] p-4 sm:p-6 lg:p-8",
  card: "bg-[#FFFBF0] border-[#9ADBCC]/50",
  btn: {
    primary: "bg-[#9ADBCC] text-[#12352E] hover:bg-[#86CFBF] shadow-none focus-visible:ring-[#5DBFA9]/60",
    soft: "bg-[#D0F2F7] text-[#24566A] hover:bg-[#BDE9F0]",
    outline: "border-[#9EB2DB] text-[#34477A] hover:bg-[#9EB2DB]/15",
  },
  iconTile: "bg-[#C7F2D1] text-[#1F5F53]",
  accentText: "text-[#1F5F53]",
  highlight: "bg-[#E3FFD6]",
  match: "bg-[#C7F2D1] text-[#1F5E3D]",
  gap: "bg-[#9EB2DB]/35 text-[#34477A]",
  choiceOn: "bg-[#9ADBCC] border-[#9ADBCC] text-[#12352E]",
  choiceOff: "bg-[#FFFBF0] border-[#9ADBCC]/50 text-charcoal-light hover:bg-[#E3FFD6]",
  status: {
    Strong: "bg-[#C7F2D1] text-[#1F5E3D]",
    "Needs Improvement": "bg-[#D0F2F7] text-[#24566A]",
    "Critical Gap": "bg-[#9EB2DB] text-[#1E2D57]",
  },
  priority: {
    High: "bg-[#9EB2DB] text-[#1E2D57]",
    Medium: "bg-[#D0F2F7] text-[#24566A]",
  },
};
