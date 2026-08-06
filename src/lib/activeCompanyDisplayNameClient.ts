interface ErpScopeListItem {
  id:
    string;
  isDefault:
    boolean;
  companyName:
    string;
}

interface ErpScopesResponse {
  success?:
    boolean;
  selectedScopeId?:
    string | null;
  scopes?:
    ErpScopeListItem[];
  error?:
    string;
}

export async function fetchActiveCompanyDisplayName():
  Promise<string> {
  const response =
    await fetch(
      "/api/erp-scopes",
      {
        method:
          "GET",
        credentials:
          "same-origin",
        cache:
          "no-store"
      }
    );

  const body =
    (
      await response
        .json()
        .catch(
          () =>
            null
        )
    ) as
      ErpScopesResponse
      | null;

  if (
    !response.ok ||
    !body?.success ||
    !Array.isArray(
      body.scopes
    )
  ) {
    throw new Error(
      body?.error ||
      "ACTIVE_COMPANY_NAME_READ_FAILED"
    );
  }

  const selected =
    (
      body.selectedScopeId
        ? body.scopes.find(
            scope =>
              scope.id ===
              body.selectedScopeId
          )
        : undefined
    ) ||
    body.scopes.find(
      scope =>
        scope.isDefault
    );

  const companyName =
    String(
      selected?.companyName ||
      ""
    ).trim();

  if (!companyName) {
    throw new Error(
      "ACTIVE_COMPANY_NAME_REQUIRED"
    );
  }

  return companyName;
}