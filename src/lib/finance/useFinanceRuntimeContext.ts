"use client";

import { useEffect, useState } from "react";
import type { ErpScope } from "@/lib/erpScope";
import type { ErpPackage } from "@/lib/packageFeatures";
import { normalizeUser, useAuthStore } from "@/store/useAuthStore";
import type { FinancePermission } from "./financeAccessPolicy";

export type FinanceRuntimeContextState =
  | { state: "loading" }
  | { state: "missing-session"; reason: "MISSING_SESSION" }
  | { state: "not-configured"; reason: string }
  | { state: "error"; reason: "ERP_CONTEXT_READ_FAILED" }
  | {
      state: "ready";
      scope: ErpScope;
      packageType: ErpPackage;
      permissions: readonly FinancePermission[];
    };

interface FinanceContextPayload {
  success?: boolean;
  configured?: boolean;
  reason?: string;
  context?: {
    ready?: boolean;
    scope?: ErpScope;
    package?: ErpPackage;
  };
}

export function useFinanceRuntimeContext(): FinanceRuntimeContextState {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const currentUser = useAuthStore((state) => state.currentUser);
  const [remote, setRemote] = useState<{
    sessionToken: string | null;
    state: FinanceRuntimeContextState;
  }>({
    sessionToken: null,
    state: { state: "loading" },
  });

  useEffect(() => {
    if (!sessionToken || !currentUser) return;

    const controller = new AbortController();

    void fetch("/api/erp-context", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as FinanceContextPayload;
        if (
          response.ok &&
          payload.success === true &&
          payload.configured === true &&
          payload.context?.ready === true &&
          payload.context.scope &&
          payload.context.package
        ) {
          const normalizedUser = normalizeUser(currentUser);
          setRemote({
            sessionToken,
            state: {
              state: "ready",
              scope: { ...payload.context.scope },
              packageType: payload.context.package,
              permissions: (normalizedUser.permissions ||
                []) as FinancePermission[],
            },
          });
          return;
        }
        if (
          response.ok &&
          payload.success === true &&
          payload.configured === false
        ) {
          setRemote({
            sessionToken,
            state: {
              state: "not-configured",
              reason: payload.reason || "ERP_CONTEXT_NOT_CONFIGURED",
            },
          });
          return;
        }
        setRemote({
          sessionToken,
          state: {
            state: "error",
            reason: "ERP_CONTEXT_READ_FAILED",
          },
        });
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }
        setRemote({
          sessionToken,
          state: {
            state: "error",
            reason: "ERP_CONTEXT_READ_FAILED",
          },
        });
      });

    return () => controller.abort();
  }, [currentUser, sessionToken]);

  if (!sessionToken || !currentUser) {
    return { state: "missing-session", reason: "MISSING_SESSION" };
  }
  return remote.sessionToken === sessionToken
    ? remote.state
    : { state: "loading" };
}
