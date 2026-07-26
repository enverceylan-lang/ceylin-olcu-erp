$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$Tests = @(
    "tests/approvedAccessPolicySuite.ts",
    "tests/businessScopeApiContractSuite.ts",
    "tests/businessScopeMigrationSqlSuite.ts",
    "tests/businessScopePreflightSqlSuite.ts",
    "tests/customerFinanceLedgerSuite.ts",
    "tests/erpContextShadowCardContractSuite.ts",
    "tests/erpScopeSelectionContractSuite.ts",
    "tests/erpScopeSuite.ts",
    "tests/installationWorkflowSuite.ts",
    "tests/localValidationSuite.ts",
    "tests/measurementPilotAccessSuite.ts",
    "tests/measurementPilotRecordAccessSuite.ts",
    "tests/packageEnforcementRolloutSuite.ts",
    "tests/packageFeaturesSuite.ts",
    "tests/packageArchitecture10ContractSuite.ts",
    "tests/packagePilotReadinessSuite.ts",
    "tests/packageScopeSqlContractSuite.ts",
    "tests/packageScopeSqlV2ContractSuite.ts",
    "tests/productionAuthorizationSuite.ts",
    "tests/productionBridgeSuite.ts",
    "tests/productionReadinessSuite.ts",
    "tests/productionSourceModelSuite.ts",
    "tests/productionWorkflowSuite.ts",
    "tests/salesFinanceSuite.ts",
    "tests/salesPaymentIdempotencySuite.ts",
    "tests/salesSyncApiContractSuite.ts",
    "tests/salesSyncClosedLockSuite.ts",
    "tests/salesSyncDiagnosticsSuite.ts",
    "tests/salesSyncPolicySuite.ts",
    "tests/salesSyncQueueBridgeSuite.ts",
    "tests/salesSyncQueueSuite.ts",
    "tests/salesSyncRoutePolicySuite.ts",
    "tests/serverErpContextApiSuite.ts",
    "tests/serverErpContextSuite.ts",
    "tests/shadowFeatureAccessSuite.ts",
    "tests/shadowRoleInventorySuite.ts",
    "tests/stockReservationGuardSuite.ts",
    "tests/storeCutCompletionSuite.ts",
    "tests/storeCutPlanningSuite.ts",
    "tests/storeCutSuggestionsSuite.ts",
    "tests/supplierSupplyFlowSuite.ts",
    "tests/tailorAssignmentGuardSuite.ts",
    "tests/tailorEarningsSuite.ts",
    "tests/userProfileSuite.ts"
)

$FailedTests = [System.Collections.Generic.List[string]]::new()

for ($Index = 0; $Index -lt $Tests.Count; $Index++) {
    $Test = $Tests[$Index]

    Write-Host ""
    Write-Host (
        "TEST {0}/{1} - {2}" -f
        ($Index + 1),
        $Tests.Count,
        $Test
    ) -ForegroundColor Cyan

    $Output = cmd.exe /d /s /c "npx.cmd tsx `"$Test`" 2>&1"
    $Code = $LASTEXITCODE

    $Output | ForEach-Object {
        Write-Host ([string]$_) -ForegroundColor DarkGray
    }

    Write-Host "Exit code: $Code" -ForegroundColor Magenta

    if ($Code -ne 0) {
        $FailedTests.Add($Test)
    }
}

Write-Host ""
Write-Host "TAM PROJE ESLINT" -ForegroundColor Cyan
$LintOutput = cmd.exe /d /s /c (
    "npx.cmd eslint src tests eslint.config.mjs --no-cache 2>&1"
)
$LintCode = $LASTEXITCODE
$LintOutput | ForEach-Object {
    Write-Host ([string]$_) -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "TYPESCRIPT" -ForegroundColor Cyan
$TsOutput = cmd.exe /d /s /c (
    "npx.cmd tsc --noEmit --pretty false 2>&1"
)
$TsCode = $LASTEXITCODE
$TsOutput | ForEach-Object {
    Write-Host ([string]$_) -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "DIFF CHECK" -ForegroundColor Cyan
$DiffOutput = cmd.exe /d /s /c "git diff --check 2>&1"
$DiffCode = $LASTEXITCODE
$DiffOutput | ForEach-Object {
    Write-Host ([string]$_) -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "SONUC" -ForegroundColor Cyan
Write-Host "Toplam test: $($Tests.Count)" -ForegroundColor Magenta
Write-Host "Hatali test: $($FailedTests.Count)" -ForegroundColor Magenta
Write-Host "ESLint: $LintCode" -ForegroundColor Magenta
Write-Host "TypeScript: $TsCode" -ForegroundColor Magenta
Write-Host "Diff check: $DiffCode" -ForegroundColor Magenta

if ($FailedTests.Count -gt 0) {
    Write-Host ""
    Write-Host "HATALI TEST DOSYALARI" -ForegroundColor Red
    $FailedTests | ForEach-Object {
        Write-Host ([string]$_) -ForegroundColor Red
    }
}

if (
    $FailedTests.Count -eq 0 -and
    $LintCode -eq 0 -and
    $TsCode -eq 0 -and
    $DiffCode -eq 0
) {
    Write-Host (
        "PAKET MIMARISI 10 TAM KAYNAK GUVENLIK VE REGRESYON PAK"
    ) -ForegroundColor Green
} else {
    Write-Host (
        "PAKET MIMARISI 10 DUR - HATA OZETI YUKARIDA"
    ) -ForegroundColor Red
}
