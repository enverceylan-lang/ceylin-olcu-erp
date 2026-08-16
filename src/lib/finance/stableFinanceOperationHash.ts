import { createHash } from "node:crypto";

type JsonPrimitive = null | boolean | number | string;
type CanonicalJson =
  | JsonPrimitive
  | readonly CanonicalJson[]
  | { readonly [key: string]: CanonicalJson };

function canonicalize(value: unknown, path: string): CanonicalJson | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`FINANCE_HASH_NON_FINITE_NUMBER:${path}`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const canonical = canonicalize(item, `${path}[${index}]`);
      return canonical === undefined ? null : canonical;
    });
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`FINANCE_HASH_NON_PLAIN_OBJECT:${path}`);
    }

    const result: Record<string, CanonicalJson> = {};
    const record = value as Record<string, unknown>;

    for (const key of Object.keys(record).sort()) {
      const canonical = canonicalize(record[key], `${path}.${key}`);
      if (canonical !== undefined) {
        result[key] = canonical;
      }
    }

    return result;
  }

  throw new Error(`FINANCE_HASH_UNSUPPORTED_VALUE:${path}`);
}

export function canonicalFinanceOperationJson(value: unknown): string {
  const canonical = canonicalize(value, "$");
  if (canonical === undefined) {
    throw new Error("FINANCE_HASH_ROOT_UNDEFINED");
  }
  return JSON.stringify(canonical);
}

export function stableFinanceOperationHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalFinanceOperationJson(value), "utf8")
    .digest("hex");
}