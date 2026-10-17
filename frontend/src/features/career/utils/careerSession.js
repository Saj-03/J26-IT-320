// Keeps the ACRDS flow (profile -> recommendations -> gap -> roadmap) for the logged-in student.
// sessionStorage gives instant reads in this tab; every change is also saved to the database
// (PUT /api/career/me/state), so the flow is still there after logging in again or on another device.
import { useEffect, useState } from "react";
import { clearSavedState, getSavedState, saveSavedState } from "../api/careerApi";

const KEY = "acrds.flow";
const DRAFT_KEY = "acrds.surveyDraft"; // unfinished survey answers in this tab (never sent until submitted)
const OWNER = "_ownerId"; // which account the cached flow belongs to (never sent to the server)

const read = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
};

const write = (flow) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(flow));
  } catch {
    /* storage unavailable - flow still works within the current page */
  }
};

const withoutOwner = (flow) => {
  const { [OWNER]: _ignored, ...rest } = flow;
  return rest;
};

let saveTimer;
const saveToServer = (flow) => {
  clearTimeout(saveTimer);
  // Small delay groups several quick updates into one request. Failures keep the local copy.
  saveTimer = setTimeout(() => saveSavedState(withoutOwner(flow)).catch(() => {}), 300);
};

/** Unfinished survey answers, so a refresh or a visit to another page does not lose them. */
export const surveyDraft = {
  get: () => {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    } catch {
      return null;
    }
  },
  save: (form) => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* storage unavailable - the form still works */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const careerSession = {
  get: () => withoutOwner(read()),
  /** Merge new values into the flow and save it for this student. */
  update: (patch) => {
    const next = { ...read(), ...patch };
    write(next);
    saveToServer(next);
    return withoutOwner(next);
  },
  /** Load the student's saved flow. A cache from another account in this browser is replaced. */
  syncFromServer: async () => {
    const { user_id: userId, data: saved } = await getSavedState();
    const local = read();
    const fromAnotherAccount = local[OWNER] !== userId;
    const localEmpty = Object.keys(withoutOwner(local)).length === 0;
    if (fromAnotherAccount || localEmpty) {
      write({ ...saved, [OWNER]: userId });
    }
    if (fromAnotherAccount) surveyDraft.clear(); // never show one student's draft to another
    return withoutOwner(read());
  },
  clear: () => sessionStorage.removeItem(KEY),
  /** Delete the student's saved flow here and in the database ("Start over"). */
  reset: async () => {
    clearTimeout(saveTimer); // drop a pending save so it cannot bring the old flow back
    await clearSavedState();
    sessionStorage.removeItem(KEY);
    surveyDraft.clear();
  },
};

/** Career flow for the current page; refreshes from the database once on mount. */
export function useCareerFlow() {
  const [flow, setFlow] = useState(() => careerSession.get());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    careerSession.syncFromServer()
      .then((synced) => active && setFlow(synced))
      .catch(() => {}) // offline or logged out: keep the local copy
      .finally(() => active && setReady(true));
    return () => { active = false; };
  }, []);
  const reset = async () => {
    await careerSession.reset();
    setFlow({});
  };
  return { flow, ready, reset };
}
