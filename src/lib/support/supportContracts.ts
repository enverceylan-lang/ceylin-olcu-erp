export const SUPPORT_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "NEEDS_EXPLANATION",
  "SUPPORT_IN_PROGRESS",
  "ARCHITECTURE_REJECTED",
  "ACCEPTED",
  "IN_DEVELOPMENT",
  "RESOLVED",
  "CLOSED",
] as const;

export type SupportStatus =
  (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_CATEGORIES = [
  "TECHNICAL",
  "USAGE_SUPPORT",
  "DEVELOPMENT_SUGGESTION",
  "SECURITY",
  "BILLING_LICENSE",
] as const;

export type SupportCategory =
  (typeof SUPPORT_CATEGORIES)[number];

export interface SupportTicketCreateInput {
  category: SupportCategory;
  moduleCode: string;
  subject: string;
  description: string;
}

export function normalizeSupportText(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export function isSupportCategory(
  value: unknown,
): value is SupportCategory {
  return (
    typeof value === "string" &&
    (
      SUPPORT_CATEGORIES as readonly string[]
    ).includes(value)
  );
}

export function parseSupportTicketCreateInput(
  value: unknown,
):
  | {
      valid: true;
      input: SupportTicketCreateInput;
    }
  | {
      valid: false;
      code:
        | "INVALID_REQUEST"
        | "INVALID_CATEGORY"
        | "INVALID_MODULE"
        | "INVALID_SUBJECT"
        | "INVALID_DESCRIPTION";
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

  if (!isSupportCategory(record.category)) {
    return {
      valid: false,
      code: "INVALID_CATEGORY",
    };
  }

  const moduleCode =
    normalizeSupportText(record.moduleCode)
      .toUpperCase();

  if (
    moduleCode.length < 2 ||
    moduleCode.length > 64 ||
    !/^[A-Z0-9_-]+$/.test(moduleCode)
  ) {
    return {
      valid: false,
      code: "INVALID_MODULE",
    };
  }

  const subject =
    normalizeSupportText(record.subject);

  if (
    subject.length < 3 ||
    subject.length > 160
  ) {
    return {
      valid: false,
      code: "INVALID_SUBJECT",
    };
  }

  const description =
    normalizeSupportText(record.description);

  if (
    description.length < 5 ||
    description.length > 5000
  ) {
    return {
      valid: false,
      code: "INVALID_DESCRIPTION",
    };
  }

  return {
    valid: true,
    input: {
      category: record.category,
      moduleCode,
      subject,
      description,
    },
  };
}