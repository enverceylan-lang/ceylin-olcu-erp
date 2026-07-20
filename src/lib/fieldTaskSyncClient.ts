import type {
  FieldTask,
  FieldTaskStatus,
} from "@/lib/localFieldTaskDb";

interface FieldTaskApiResponse {
  success: boolean;
  task?: FieldTask;
  tasks?: FieldTask[];
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

  return {
    tasks: result.tasks || [],
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
