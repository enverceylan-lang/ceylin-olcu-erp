import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "Plicell WhatsApp uses active company and compact requested format",
  async () => {
    const formatter =
      await readFile(
        "src/lib/reportFormatters.ts",
        "utf8"
      );

    const page =
      await readFile(
        "src/app/cariler/[id]/page.tsx",
        "utf8"
      );

    const visual =
      await readFile(
        "src/components/reports/MeasurementVisualReport.tsx",
        "utf8"
      );

    const companyClient =
      await readFile(
        "src/lib/activeCompanyDisplayNameClient.ts",
        "utf8"
      );

    assert.match(
      formatter,
      /buildPlicellOnlyWhatsAppReport/
    );

    assert.match(
      formatter,
      /\$\{companyName\} — ÖLÇÜ RAPORU/
    );

    assert.match(
      formatter,
      /\* Plicell/
    );

    assert.match(
      formatter,
      /Profil:/
    );

    assert.match(
      formatter,
      /Cam:/
    );

    assert.match(
      formatter,
      /en/
    );

    assert.match(
      formatter,
      /boy/
    );

    assert.match(
      formatter,
      /formatWhatsAppMeasurementCm/
    );

    assert.match(
      formatter,
      /Toplam M2:/
    );

    assert.match(
      formatter,
      /getStoredProductCalculation\(\s*measurement,\s*"PLICELL"\s*\)/
    );

    assert.match(
      companyClient,
      /fetch\(\s*"\/api\/erp-scopes"/
    );

    assert.match(
      companyClient,
      /selectedScopeId/
    );

    assert.match(
      companyClient,
      /companyName/
    );

    assert.match(
      page,
      /fetchActiveCompanyDisplayName/
    );

    assert.match(
      visual,
      /fetchActiveCompanyDisplayName/
    );

    assert.match(
      visual,
      /buildWhatsAppShortReport\([\s\S]*activeCompanyName[\s\S]*\)/
    );

    assert.doesNotMatch(
      formatter,
      /\*CEYLİN PERDE — ÖLÇÜ RAPORU\*/
    );
  }
);
