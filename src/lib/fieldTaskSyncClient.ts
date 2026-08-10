import {
  deleteLocalFieldTasks,
  type FieldTask,
  type FieldTaskStatus,
} from "@/lib/localFieldTaskDb";

interface FieldTaskApiResponse {
  success: boolean;
  task?: FieldTask;
  tasks?: FieldTask[];
  deletedTaskIds?: string[];
  serverTime?: string;
  error?: string;
}

async function parseResponse(
  response: Response,
): Promise<FieldTaskApiResponse> {
  let result: FieldTaskApiResponse;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Field task API returned HTTP ${response.status}.`,
    );
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.error ||
        `Field task API returned HTTP ${response.status}.`,
    );
  }

  return result;
}

export async function createRemoteFieldTask(
  task: FieldTask,
  sessionToken: string,
): Promise<FieldTask> {
  const response = await fetch(
    "/api/field-tasks",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(task),
    },
  );

  const result =
    await parseResponse(response);

  if (!result.task) {
    throw new Error(
      "Server did not return the created task.",
    );
  }

  return result.task;
}

export async function fetchRemoteFieldTasks(
  sessionToken: string,
  since?: string,
): Promise<{
  tasks: FieldTask[];
  deletedTaskIds: string[];
  serverTime: string;
}> {
  const params =
    new URLSearchParams();

  if (since) {
    params.set("since", since);
  }

  const query =
    params.toString();

  const response = await fetch(
    `/api/field-tasks${query ? `?${query}` : ""}`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${sessionToken}`,
      },
      cache: "no-store",
    },
  );

  const result =
    await parseResponse(response);

  const deletedTaskIds =
    Array.isArray(result.deletedTaskIds)
      ? result.deletedTaskIds.filter(
          (id): id is string =>
            typeof id === "string" &&
            Boolean(id),
        )
      : [];

  if (deletedTaskIds.length > 0) {
    await deleteLocalFieldTasks(
      deletedTaskIds,
    );
  }

  return {
    tasks: result.tasks || [],
    deletedTaskIds,
    serverTime:
      result.serverTime ||
      new Date().toISOString(),
  };
}

export async function updateRemoteFieldTask(
  id: string,
  status: FieldTaskStatus,
  sessionToken: string,
  markSeen = true,
): Promise<FieldTask> {
  const response = await fetch(
    "/api/field-tasks",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        id,
        status,
        markSeen,
      }),
    },
  );

  const result =
    await parseResponse(response);

  if (!result.task) {
    throw new Error(
      "Server did not return the updated task.",
    );
  }

  return result.task;
}

export type FieldTaskLifecycleAction =
  | "CANCEL"
  | "ARCHIVE"
  | "RESTORE";

export interface FieldTaskLifecycleResponse {
  success: boolean;
  task?: FieldTask;
  idempotent?: boolean;
  deletion?: {
    deleted?: boolean;
    alreadyDeleted?: boolean;
    taskId?: string;
    deletedAt?: string;
  };
  error?: string;
}

async function parseLifecycleResponse(
  response: Response,
): Promise<FieldTaskLifecycleResponse> {
  let result: FieldTaskLifecycleResponse;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Field task lifecycle API returned HTTP ${response.status}.`,
    );
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.error ||
        `Field task lifecycle API returned HTTP ${response.status}.`,
    );
  }

  return result;
}

export async function updateRemoteFieldTaskLifecycle(
  id: string,
  action: FieldTaskLifecycleAction,
  sessionToken: string,
  reason?: string,
): Promise<{
  task: FieldTask;
  idempotent: boolean;
}> {
  const response = await fetch(
    "/api/field-tasks/lifecycle",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        id,
        action,
        reason,
      }),
    },
  );

  const result =
    await parseLifecycleResponse(response);

  if (!result.task) {
    throw new Error(
      "Server did not return the lifecycle-updated task.",
    );
  }

  return {
    task: result.task,
    idempotent:
      result.idempotent === true,
  };
}

export async function deleteRemoteFieldTaskLifecycle(
  id: string,
  sessionToken: string,
  reason: string,
): Promise<{
  deleted: boolean;
  alreadyDeleted: boolean;
  taskId: string;
}> {
  const response = await fetch(
    "/api/field-tasks/lifecycle",
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        id,
        reason,
      }),
    },
  );

  const result =
    await parseLifecycleResponse(response);

  const deletion =
    result.deletion || {};

  const taskId =
    typeof deletion.taskId === "string" &&
    deletion.taskId
      ? deletion.taskId
      : id;

  return {
    deleted:
      deletion.deleted === true,
    alreadyDeleted:
      deletion.alreadyDeleted === true,
    taskId,
  };
}
export interface FieldTaskCustomerPackage {
  customer: import("@/store/useStore").Customer;
  measurements: import("@/store/measurementStore").MeasurementRecord[];
  counts: {
    rooms: number;
    openings: number;
    measurements: number;
  };
  serverTime: string;
}

export async function fetchFieldTaskCustomerPackage(
  taskId: string,
  sessionToken: string,
): Promise<FieldTaskCustomerPackage> {
  const response = await fetch(
    `/api/field-tasks/${encodeURIComponent(taskId)}/customer-package`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${sessionToken}`,
      },
      cache: "no-store",
    },
  );

  let result: {
    success?: boolean;
    customer?: import("@/store/useStore").Customer;
    measurements?: import("@/store/measurementStore").MeasurementRecord[];
    counts?: {
      rooms: number;
      openings: number;
      measurements: number;
    };
    serverTime?: string;
    error?: string;
  };

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Cari paketi HTTP ${response.status} döndürdü.`,
    );
  }

  if (
    !response.ok ||
    !result.success ||
    !result.customer
  ) {
    throw new Error(
      result.error ||
        "Görev carisi sunucudan alınamadı.",
    );
  }

  return {
    customer:
      result.customer,
    measurements:
      result.measurements || [],
    counts:
      result.counts || {
        rooms: 0,
        openings: 0,
        measurements: 0,
      },
    serverTime:
      result.serverTime ||
      new Date().toISOString(),
  };
}
