// Roadmap checklist: each roadmap item has three parts the student can tick off.
// Progress is stored in the career flow as { [skill]: { course, project, task } } (saved to the database).
export const ROADMAP_PART_KEYS = ["course", "project", "task"];
export const ROADMAP_PART_LABELS = { course: "Course", project: "Project", task: "Practice task" };

export function roadmapStats(roadmap, progress = {}) {
  const items = roadmap?.roadmap || [];
  const total = items.length * ROADMAP_PART_KEYS.length;
  const done = items.reduce((n, it) => n + ROADMAP_PART_KEYS.filter((k) => progress?.[it.skill]?.[k]).length, 0);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 100 };
}

/** First part not yet done, in roadmap order (High priority first): the student's focus for this week. */
export function nextRoadmapStep(roadmap, progress = {}) {
  for (const item of roadmap?.roadmap || []) {
    const key = ROADMAP_PART_KEYS.find((k) => !progress?.[item.skill]?.[k]);
    if (key) return { item, key, label: ROADMAP_PART_LABELS[key] };
  }
  return null;
}
