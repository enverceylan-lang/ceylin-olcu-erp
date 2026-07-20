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

  return rows.sort(
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

  return rows.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
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
): Promise<void> {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return;
  }

  await localFieldTaskDb.fieldTasks.bulkPut(tasks);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("field-tasks-updated"),
    );
  }
}

export async function putFieldTask(
  task: FieldTask,
): Promise<void> {
  await localFieldTaskDb.fieldTasks.put(task);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("field-tasks-updated"),
    );
  }
}

