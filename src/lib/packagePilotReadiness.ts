export interface PackagePilotReadinessInput {
  accessPolicyApproved: boolean;
  allActiveUsersScoped: boolean;
  packageLicenseReady: boolean;
  shadowRegressionPassed: boolean;
  ownershipRegressionPassed: boolean;
  rollbackVerified: boolean;
  activationApproved: boolean;
}

export interface PackagePilotReadinessResult {
  readyForActivation: boolean;
  missing: Array<keyof PackagePilotReadinessInput>;
}

export function evaluatePackagePilotReadiness(
  input: PackagePilotReadinessInput
): PackagePilotReadinessResult {
  const required = Object.keys(
    input
  ) as Array<keyof PackagePilotReadinessInput>;
  const missing = required.filter((key) => input[key] !== true);

  return {
    readyForActivation: missing.length === 0,
    missing,
  };
}
