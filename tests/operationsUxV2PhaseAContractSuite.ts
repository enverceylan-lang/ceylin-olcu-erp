import fs from "node:fs";
import path from "node:path";

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8",
  );
}

function assertIncludes(
  source: string,
  expected: string,
  label: string,
): void {
  if (!source.includes(expected)) {
    throw new Error(
      `DUR: ${label} missing: ${expected}`,
    );
  }
}

function assertNotIncludes(
  source: string,
  expected: string,
  label: string,
): void {
  if (source.includes(expected)) {
    throw new Error(
      `DUR: ${label} forbidden: ${expected}`,
    );
  }
}

const sidebar = read(
  "src/components/Sidebar.tsx",
);
const operationsPage = read(
  "src/app/operasyonlar/page.tsx",
);
const management = read(
  "src/components/operations/v2/OperationsManagementV2.tsx",
);
const materialQueue = read(
  "src/components/operations/v2/MaterialQueueV2.tsx",
);
const tailorQueue = read(
  "src/components/operations/v2/TailorQueueV2.tsx",
);
const montaj = read(
  "src/app/montaj/page.tsx",
);
const cutPanel = read(
  "src/components/operations/MaterialCutDecisionPanel.tsx",
);
const cutSlip = read(
  "src/lib/cutSlipOutput.ts",
);

assertIncludes(
  sidebar,
  'const operationsMenuItems = [',
  "Sidebar operations submenu",
);
assertIncludes(
  sidebar,
  '/operasyonlar/kesim',
  "Sidebar cut route",
);
assertIncludes(
  sidebar,
  '/operasyonlar/atolye',
  "Sidebar tailor route",
);
assertIncludes(
  sidebar,
  '/operasyonlar/tedarik',
  "Sidebar procurement route",
);
assertIncludes(
  sidebar,
  '{ name: "Montaj", href: "/montaj" }',
  "Sidebar montaj child route",
);
assertNotIncludes(
  sidebar,
  '{ name: "Montaj", href: "/montaj", icon: Wrench }',
  "Standalone montaj top-level menu",
);

assertIncludes(
  operationsPage,
  'import OperationsManagementV2 from "@/components/operations/v2/OperationsManagementV2";',
  "Operations V2 import",
);
assertIncludes(
  operationsPage,
  'if (String(portalMode.mode) === "MANAGEMENT")',
  "Management V2 branch",
);
assertIncludes(
  operationsPage,
  "managementVisibleOperations",
  "Scoped management projection",
);

assertIncludes(
  management,
  'operation.kind === "GENERAL"',
  "GENERAL-only main projection",
);
assertIncludes(
  management,
  "Operasyon Yönet",
  "Operations manage action",
);
assertIncludes(
  management,
  "Kesim & Malzeme",
  "Cut workspace",
);
assertIncludes(
  management,
  "Atölye / Terzi",
  "Tailor workspace",
);
assertIncludes(
  management,
  "Tedarik",
  "Procurement workspace",
);
assertIncludes(
  management,
  "Montaj",
  "Installation workspace",
);

assertIncludes(
  materialQueue,
  "MaterialCutDecisionPanel",
  "Material queue reuses canonical panel",
);
assertIncludes(
  materialQueue,
  'mode === "PROCUREMENT"',
  "Procurement mode",
);
assertNotIncludes(
  materialQueue,
  "@/lib/finance/",
  "Material queue finance isolation",
);

assertIncludes(
  tailorQueue,
  'operation.kind === "TAILOR"',
  "TAILOR-only queue",
);
assertNotIncludes(
  tailorQueue,
  "updateStatus(",
  "Atolye presentation-only phase",
);

assertIncludes(
  montaj,
  "createAutomaticInstallationEarning",
  "Montaj earning coordinator preserved",
);
assertIncludes(
  montaj,
  ".registerAutomaticProviderEarning({",
  "Montaj earning registration preserved",
);
assertIncludes(
  montaj,
  "handleAdvance(",
  "Montaj lifecycle handler preserved",
);
assertIncludes(
  montaj,
  'className="hidden overflow-x-auto md:block"',
  "Montaj desktop table",
);
assertIncludes(
  montaj,
  "md:hidden",
  "Montaj mobile projection",
);

assertIncludes(
  cutPanel,
  "handlePrintCutSlip",
  "Cut slip action",
);
assertIncludes(
  cutPanel,
  "pendingStoreCuts.length > 0",
  "Cut slip requires canonical reservation",
);
assertIncludes(
  cutSlip,
  "cutOrderId",
  "Cut slip cut order identity",
);
assertIncludes(
  cutSlip,
  "Top / Lot",
  "Cut slip lot output",
);
assertNotIncludes(
  cutSlip,
  "localStorage",
  "Cut slip no persistence",
);

console.log(
  "PAK: OPERATIONS_UX_V2_PHASE_A_CONTRACT",
);
