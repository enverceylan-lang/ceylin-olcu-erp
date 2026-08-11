import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "Montaj page uses operations backbone instead of legacy montageTasks",
  async () => {
    const source =
      await readFile(
        "src/app/montaj/page.tsx",
        "utf8"
      );

    assert.match(
      source,
      /useOperationsStore/
    );

    assert.match(
      source,
      /getVisibleOperations/
    );

    assert.match(
      source,
      /operation\.kind ===\s*"INSTALLATION"/
    );

    assert.match(
      source,
      /updateStatus/
    );

    assert.doesNotMatch(
      source,
      /montageTasks/
    );

    assert.doesNotMatch(
      source,
      /updateMontageStatus/
    );

    assert.doesNotMatch(
      source,
      /updateMontageTask/
    );
  }
);

test(
  "Montaj page keeps scope and assigned-user visibility contract",
  async () => {
    const source =
      await readFile(
        "src/app/montaj/page.tsx",
        "utf8"
      );

    assert.match(
      source,
      /useErpRuntimeContext/
    );

    assert.match(
      source,
      /userId:\s*currentUser\.id/
    );

    assert.match(
      source,
      /role:\s*currentUser\.role/
    );
  }
);

test(
  "Montaj page displays internal external assignment semantics",
  async () => {
    const source =
      await readFile(
        "src/app/montaj/page.tsx",
        "utf8"
      );

    assert.match(
      source,
      /assignmentType/
    );

    assert.match(
      source,
      /INTERNAL/
    );

    assert.match(
      source,
      /Şirket içi/
    );

    assert.match(
      source,
      /Dış montajcı/
    );
  }
);

test(
  "Montaj status path uses operation transition chain",
  async () => {
    const source =
      await readFile(
        "src/app/montaj/page.tsx",
        "utf8"
      );

    assert.match(
      source,
      /DRAFT:\s*"ASSIGNED"/
    );

    assert.match(
      source,
      /IN_PROGRESS:\s*"COMPLETED"/
    );

    assert.match(
      source,
      /updateStatus\(\s*operation\.id/
    );
  }
);