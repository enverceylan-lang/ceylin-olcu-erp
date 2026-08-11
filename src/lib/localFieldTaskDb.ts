import Dexie, { type Table } from "dexie";

export type FieldTaskStatus =
  | "ASSIGNED"
  | "ON_THE_WAY"
  | "MEASUREMENT_STARTED"
  | "MEASUREMENT_TAKEN"
  | "COMPLETED"
  | "CANCELLED";

export interface FieldTask {
  id: string;

  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  mapLocation?: string;

  /*
   * Görev anındaki fotoğrafsız cari/oda/açıklık/ölçü çalışma paketi.
   * Ana cari kaydı değildir.
   */
  customerSnapshot?: Record<string, unknown>;

  assignedUserId: string;
  assignedUserName: string;

  assignedById: string;
  assignedByName: string;

  scheduledAt?: string;
  note?: string;

  status: FieldTaskStatus;

  createdAt: string;
  updatedAt: string;
  seenAt?: string;
  completedAt?: string;

  cancelledAt?: string;
  cancelledById?: string;
  cancelledByName?: string;
  cancelReason?: string;

  archivedAt?: string;
  archivedById?: string;
  archivedByName?: string;

  /* Local provenance only: proves this record was returned by the server. */
  remoteKnownAt?: string;
}

class CeylinFieldTaskDb extends Dexie {
  fieldTasks!: Table<FieldTask, string>;

  constructor() {
    super("CeylinFieldTaskDb");

    this.version(1).stores({
      fieldTasks:
        "id, customerId, assignedUserId, status, createdAt, updatedAt, scheduledAt"
    });
  }
}

export const localFieldTaskDb =
  new CeylinFieldTaskDb();

export async function createFieldTask(
  task: Omit<
    FieldTask,
    "id" | "createdAt" | "updatedAt" | "status"
  >
): Promise<FieldTask> {
  const now =
    new Date().toISOString();

  const record: FieldTask = {
    ...task,
    id:
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `field-task-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}`,
    status: "ASSIGNED",
    createdAt: now,
    updatedAt: now
  };

  await localFieldTaskDb.fieldTasks.put(
    record
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("field-tasks-updated", {
        detail: {
          taskId: record.id,
          assignedUserId:
            record.assignedUserId
        }
      })
    );
  }

  return record;
}

export async function listFieldTasksForUser(
  userId: string
): Promise<FieldTask[]> {
  if (!userId) return [];

  const rows =
    await localFieldTaskDb.fieldTasks
      .where("assignedUserId")
      .equals(userId)
      .toArray();

  return rows
    .filter(task => !task.archivedAt)
    .sort(
      (a, b) =>
        new Date(
          b.scheduledAt ||
            b.createdAt
        ).getTime() -
        new Date(
          a.scheduledAt ||
            a.createdAt
        ).getTime()
    );
}

export async function listAllFieldTasks():
Promise<FieldTask[]> {
  const rows =
    await localFieldTaskDb.fieldTasks
      .toArray();

  return rows
    .filter(task => !task.archivedAt)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );
}

export async function listArchivedFieldTasks():
Promise<FieldTask[]> {
  const rows =
    await localFieldTaskDb.fieldTasks
      .toArray();

  return rows
    .filter(task => Boolean(task.archivedAt))
    .sort(
      (a, b) =>
        new Date(
          b.archivedAt ||
            b.updatedAt
        ).getTime() -
        new Date(
          a.archivedAt ||
            a.updatedAt
        ).getTime()
    );
}

export async function updateFieldTaskStatus(
  id: string,
  status: FieldTaskStatus
): Promise<void> {
  const now =
    new Date().toISOString();

  await localFieldTaskDb.fieldTasks.update(
    id,
    {
      status,
      updatedAt: now,
      completedAt:
        status === "COMPLETED"
          ? now
          : undefined
    }
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("field-tasks-updated")
    );
  }
}

export async function markFieldTaskSeen(
  id: string
): Promise<void> {
  await localFieldTaskDb.fieldTasks.update(
    id,
    {
      seenAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString()
    }
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("field-tasks-updated")
    );
  }
}

export async function upsertRemoteFieldTasks(
  tasks: FieldTask[],
  remoteKnownAt = new Date().toISOString(),
): Promise<void> {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return;
  }

  await localFieldTaskDb.fieldTasks.bulkPut(
    tasks.map(task => ({
      ...task,
      remoteKnownAt,
    })),
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("field-tasks-updated"),
    );
  }
}

export async function reconcileAuthoritativeRemoteFieldTasks({
  tasks,
  deletedTaskIds = [],
  confirmedAbsentTaskIds = [],
  remoteKnownAt = new Date().toISOString(),
}: {
  tasks: FieldTask[];
  deletedTaskIds?: string[];
  confirmedAbsentTaskIds?: string[];
  remoteKnownAt?: string;
}): Promise<{ removedTaskIds: string[] }> {
  const remoteIds = new Set(tasks.map(task => task.id).filter(Boolean));
  const explicitlyAbsentIds = new Set([
    ...deletedTaskIds,
    ...confirmedAbsentTaskIds,
  ].filter(Boolean));

  const removedTaskIds = await localFieldTaskDb.transaction(
    "rw",
    localFieldTaskDb.fieldTasks,
    async () => {
      const localTasks = await localFieldTaskDb.fieldTasks.toArray();
      const staleIds = localTasks
        .filter(task =>
          explicitlyAbsentIds.has(task.id) ||
          (
            Boolean(task.remoteKnownAt) &&
            !task.archivedAt &&
            !remoteIds.has(task.id)
          )
        )
        .map(task => task.id);

      if (staleIds.length > 0) {
        await localFieldTaskDb.fieldTasks.bulkDelete(staleIds);
      }

      if (tasks.length > 0) {
        await localFieldTaskDb.fieldTasks.bulkPut(
          tasks.map(task => ({
            ...task,
            remoteKnownAt,
          })),
        );
      }

      return staleIds;
    },
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("field-tasks-updated"));
  }

  return { removedTaskIds };
}

export async function putFieldTask(
  task: FieldTask,
  markRemote = false,
): Promise<void> {
  await localFieldTaskDb.fieldTasks.put(
    markRemote
      ? {
          ...task,
          remoteKnownAt: new Date().toISOString(),
        }
      : task,
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("field-tasks-updated"),
    );
  }
}

export async function deleteLocalFieldTask(
  id: string,
): Promise<void> {
  if (!id) return;

  await localFieldTaskDb.fieldTasks.delete(id);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("field-tasks-updated"),
    );
  }
}

export async function deleteLocalFieldTasks(
  ids: string[],
): Promise<void> {
  const uniqueIds =
    Array.from(
      new Set(
        ids.filter(Boolean),
      ),
    );

  if (uniqueIds.length === 0) {
    return;
  }

  await localFieldTaskDb.fieldTasks.bulkDelete(
    uniqueIds,
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("field-tasks-updated"),
    );
  }
}
