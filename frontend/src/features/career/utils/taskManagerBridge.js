// Hand-off point between the ACRDS roadmap and the Task Manager (another team member's component).
// Integration is NOT implemented yet: nothing is sent anywhere and nothing is stored.
// When the Task Manager is ready, replace the body of addRoadmapToTaskManager() with the real API call
// and return { status: "added" }; the roadmap page already handles that result.

/** Roadmap -> plain task list (what would be sent to the Task Manager). Pure, so it can be tested. */
export function roadmapToTasks(roadmap) {
  if (!roadmap) return [];
  const career = roadmap.career_name;
  const skillTasks = (roadmap.roadmap || []).flatMap((item) => [
    { title: item.course, kind: "course", skill: item.skill, priority: item.priority, estimate: item.estimated_time },
    { title: item.project, kind: "project", skill: item.skill, priority: item.priority, estimate: item.estimated_time },
    { title: item.task, kind: "task", skill: item.skill, priority: item.priority, estimate: item.estimated_time },
  ]);
  const milestoneTasks = (roadmap.milestones || []).map((m) => ({
    title: m.title, kind: "milestone", milestone: m.id, estimate: m.timeframe,
  }));
  return [...skillTasks, ...milestoneTasks].map((task) => ({ ...task, career, career_id: roadmap.career_id }));
}

/**
 * Add the roadmap to the student's Task Manager.
 * @returns {Promise<{status: "added" | "unavailable", count?: number}>}
 */
// eslint-disable-next-line no-unused-vars
export async function addRoadmapToTaskManager(roadmap) {
  // Future integration, e.g.:
  //   const tasks = roadmapToTasks(roadmap);
  //   await taskManagerApi.createTasks(tasks);
  //   return { status: "added", count: tasks.length };
  return { status: "unavailable" }; // never claim the roadmap was stored
}
