import {
  SUPPORT_STATUSES,
  type SupportStatus,
  normalizeSupportText,
} from "./supportContracts";

export interface SupportMessageCreateInput {
  body: string;
}

export interface SupportStatusTransitionInput {
  status: SupportStatus;
  note: string | null;
}

export function isSupportStatus(
  value: unknown,
): value is SupportStatus {
  return (
    typeof value === "string" &&
    (
      SUPPORT_STATUSES as readonly string[]
    ).includes(value)
  );
}

export function parseSupportMessageCreateInput(
  value: unknown,
):
  | {
      valid: true;
      input: SupportMessageCreateInput;
    }
  | {
      valid: false;
      code:
        | "INVALID_REQUEST"
        | "INVALID_MESSAGE";
    } {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {
      valid: false,
      code: "INVALID_REQUEST",
    };
  }

  const record =
    value as Record<string, unknown>;

  const body =
    normalizeSupportText(record.body);

  if (
    body.length < 1 ||
    body.length > 5000
  ) {
    return {
      valid: false,
      code: "INVALID_MESSAGE",
    };
  }

  return {
    valid: true,
    input: {
      body,
    },
  };
}

export function parseSupportStatusTransitionInput(
  value: unknown,
):
  | {
      valid: true;
      input: SupportStatusTransitionInput;
    }
  | {
      valid: false;
      code:
        | "INVALID_REQUEST"
        | "INVALID_STATUS"
        | "INVALID_NOTE";
    } {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {
      valid: false,
      code: "INVALID_REQUEST",
    };
  }

  const record =
    value as Record<string, unknown>;

  if (!isSupportStatus(record.status)) {
    return {
      valid: false,
      code: "INVALID_STATUS",
    };
  }

  const normalizedNote =
    normalizeSupportText(record.note);

  if (normalizedNote.length > 2000) {
    return {
      valid: false,
      code: "INVALID_NOTE",
    };
  }

  return {
    valid: true,
    input: {
      status: record.status,
      note:
        normalizedNote.length > 0
          ? normalizedNote
          : null,
    },
  };
}