import type { FieldTask } from "./localFieldTaskDb";

export type FieldTaskViewMode = "ACTIVE" | "ARCHIVE";

export function isArchivedFieldTask(
  task: Pick<FieldTask, "archivedAt">,
): boolean {
  return Boolean(task.archivedAt);
}

export function isFieldTaskInView(
  task: Pick<FieldTask, "archivedAt">,
  viewMode: FieldTaskViewMode,
): boolean {
  const archived = isArchivedFieldTask(task);
  return viewMode === "ARCHIVE" ? archived : !archived;
}

export function filterFieldTasksByView<T extends Pick<FieldTask, "archivedAt">>(
  tasks: T[],
  viewMode: FieldTaskViewMode,
): T[] {
  return tasks.filter(task => isFieldTaskInView(task, viewMode));
}
