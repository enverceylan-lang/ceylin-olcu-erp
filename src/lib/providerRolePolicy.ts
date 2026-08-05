export type ProviderRole =
  | "TAILOR"
  | "INSTALLER";

export function getProviderRole(
  role: string | null | undefined
): ProviderRole | undefined {
  if (
    role === "TAILOR" ||
    role === "PRODUCTION"
  ) {
    return "TAILOR";
  }

  if (
    role === "INSTALLER" ||
    role === "INSTALLATION"
  ) {
    return "INSTALLER";
  }

  return undefined;
}

export function isProviderRole(
  role: string | null | undefined
): boolean {
  return getProviderRole(role) !== undefined;
}

export function getProviderHomePath(
  role: string | null | undefined
): "/uretim" | "/montaj" | undefined {
  const providerRole = getProviderRole(role);

  if (providerRole === "TAILOR") {
    return "/uretim";
  }

  if (providerRole === "INSTALLER") {
    return "/montaj";
  }

  return undefined;
}