// Keeps the ACRDS flow (profile -> recommendations -> gap -> roadmap) in
// sessionStorage so a page refresh does not lose the student's results.
const KEY = "acrds.flow";

const read = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
};

export const careerSession = {
  get: read,
  /** Merge new values into the stored flow state. */
  update: (patch) => {
    const next = { ...read(), ...patch };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable - flow still works within the current page */
    }
    return next;
  },
  clear: () => sessionStorage.removeItem(KEY),
};
