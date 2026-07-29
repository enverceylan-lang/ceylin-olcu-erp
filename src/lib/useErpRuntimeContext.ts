"use client";

import {
  useCallback,
  useEffect,
  useState
} from "react";
import type {
  ErpScope
} from "./erpScope";
import {
  validateErpScope
} from "./erpScope";
import {
  useAuthStore
} from "@/store/useAuthStore";

interface ReadyErpContextResponse {
  success: true;
  configured: true;
  context: {
    scope: ErpScope;
    package?: string;
  };
}

interface NotReadyErpContextResponse {
  success: boolean;
  configured?: false;
  reason?: string;
  error?: string;
}

type ErpContextResponse =
  | ReadyErpContextResponse
  | NotReadyErpContextResponse;

export interface ErpRuntimeContextState {
  scope: ErpScope | null;
  packageName: string | null;
  loading: boolean;
  error: string | null;
  reload(): Promise<void>;
}

export function useErpRuntimeContext():
  ErpRuntimeContextState {
  const sessionToken = useAuthStore(
    state => state.sessionToken
  );

  const [scope, setScope] =
    useState<ErpScope | null>(null);

  const [packageName, setPackageName] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScope(null);
    setPackageName(null);

    if (!sessionToken) {
      setError("ERP_CONTEXT_SESSION_REQUIRED");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        "/api/erp-context",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization:
              `Bearer ${sessionToken}`
          }
        }
      );

      const body =
        await response.json() as
          ErpContextResponse;

      if (
        !response.ok ||
        body.success !== true ||
        body.configured !== true ||
        !("context" in body)
      ) {
        const reason =
          "reason" in body
            ? body.reason
            : undefined;

        const apiError =
          "error" in body
            ? body.error
            : undefined;

        setError(
          reason ??
          apiError ??
          "ERP_CONTEXT_NOT_READY"
        );

        setLoading(false);
        return;
      }

      const validation =
        validateErpScope(
          body.context.scope
        );

      if (!validation.valid) {
        setError(
          `ERP_CONTEXT_SCOPE_INVALID:${validation.missingFields.join(",")}`
        );

        setLoading(false);
        return;
      }

      setScope(body.context.scope);
      setPackageName(
        body.context.package ?? null
      );
    } catch {
      setError(
        "ERP_CONTEXT_REQUEST_FAILED"
      );
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void reload();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [reload]);

  return {
    scope,
    packageName,
    loading,
    error,
    reload
  };
}