"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

interface ScopeOption {
  id: string;
  companyName: string;
  branchName: string;
  periodName: string;
}

export function ErpScopeSelector() {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [selected, setSelected] = useState("");
  const [canSelect, setCanSelect] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sessionToken) return;
    const controller = new AbortController();
    void fetch("/api/erp-scopes", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.success !== true) return;
        setScopes(Array.isArray(payload.scopes) ? payload.scopes : []);
        setSelected(String(payload.selectedScopeId || ""));
        setCanSelect(payload.canSelect === true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [sessionToken]);

  if (!sessionToken || scopes.length === 0) return null;

  const changeScope = async (scopeId: string) => {
    if (!canSelect || scopeId === selected) return;
    setBusy(true);
    try {
      const response = await fetch("/api/erp-scopes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scopeId }),
        cache: "no-store",
      });
      if (response.ok) window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-800">
      <Building2 className="h-4 w-4 shrink-0 text-indigo-600" />
      <span className="sr-only">Aktif şirket, şube ve dönem</span>
      <select
        value={selected}
        disabled={!canSelect || busy || scopes.length < 2}
        onChange={(event) => void changeScope(event.target.value)}
        className="max-w-48 min-w-0 bg-transparent text-xs font-semibold text-gray-700 outline-none disabled:cursor-default dark:text-gray-200 sm:max-w-64"
        title="Aktif şirket, şube ve muhasebe dönemi"
      >
        {scopes.map((scope) => (
          <option key={scope.id} value={scope.id}>
            {scope.companyName} • {scope.branchName} • {scope.periodName}
          </option>
        ))}
      </select>
    </label>
  );
}
