// Keeps the ACRDS flow (profile -> recommendations -> gap -> roadmap) for the logged-in student.
// sessionStorage gives instant reads in this tab; every change is also saved to the database
// (PUT /api/career/me/state), so the flow is still there after logging in again or on another device.
import { useEffect, useState } from "react";
import {
  clearSavedState, generateRoadmap, getGapAnalysis, getSavedState, recommendCareers, saveSavedState,
} from "../api/careerApi";
import { getLanguage, setLanguage } from "../i18n";

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

// Pages showing the flow re-read it when it changes (e.g. after a language switch).
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

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
  /** Account the cached flow belongs to (used to scope the unsaved CV draft in this tab). */
  ownerId: () => read()[OWNER] || null,
  /** Merge new values into the flow and save it for this student. */
  update: (patch) => {
    const next = { ...read(), ...patch };
    write(next);
    saveToServer(next);
    notify();
    return withoutOwner(next);
  },
  subscribe: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Re-fetch the saved results in `lang` (the backend writes all student-facing text).
   *  Scores, rankings and gaps are identical in every language, so only the wording changes. */
  relocalize: async (lang = getLanguage()) => {
    const flow = withoutOwner(read());
    if (!flow.profile || (flow.language || "en") === lang) return;
    const patch = { language: lang };
    const rec = await recommendCareers(flow.profile);
    Object.assign(patch, { recommendations: rec.recommendations, persona: rec.persona });
    const careerId = flow.gapAnalysis?.career_id || flow.selectedCareer?.career_id;
    if (careerId) {
      patch.selectedCareer = rec.recommendations.find((r) => r.career_id === careerId) || flow.selectedCareer;
      if (flow.gapAnalysis) patch.gapAnalysis = await getGapAnalysis({ career_id: careerId, profile: flow.profile });
      if (flow.roadmap) patch.roadmap = await generateRoadmap({ career_id: careerId, profile: flow.profile });
    }
    if (getLanguage() === lang) careerSession.update(patch); // ignore if the student switched again meanwhile
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
    // Saved results written in another language (e.g. chosen on another device): translate them.
    careerSession.relocalize().catch(() => {});
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

/** Switch the career pages to another language and translate the saved results. */
export async function changeLanguage(code) {
  setLanguage(code);
  await careerSession.relocalize(code);
}

/** Career flow for the current page; refreshes from the database once on mount. */
export function useCareerFlow() {
  const [flow, setFlow] = useState(() => careerSession.get());
  const [ready, setReady] = useState(false);
  useEffect(() => careerSession.subscribe(() => setFlow(careerSession.get())), []);
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
