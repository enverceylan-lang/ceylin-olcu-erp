import fs from "node:fs";
import path from "node:path";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const root = process.cwd();

const list = fs.readFileSync(
  path.join(
    root,
    "src/app/satis/page.tsx",
  ),
  "utf8",
);

const detail = fs.readFileSync(
  path.join(
    root,
    "src/app/satis/[id]/page.tsx",
  ),
  "utf8",
);

assert(
  list.includes('"Satışı Onayla"'),
  "Sales list must expose Satışı Onayla.",
);

assert(
  list.includes("handleApproveSale"),
  "Sales list must keep canonical approval handler.",
);

assert(
  detail.includes(
    "const persistSale = async",
  ),
  "Sale detail must use explicit persistence function.",
);

assert(
  detail.includes(
    "const handleApproveSale = async",
  ),
  "Sale detail must expose an approval handler.",
);

assert(
  detail.includes(
    "await persistSale({",
  ) &&
    detail.includes(
      'status: "ONAYLANDI"',
    ),
  "Detail approval must persist an explicit approved Sale object.",
);

assert(
  detail.includes(
    "canApproveSpecificSale(",
  ),
  "Detail approval must enforce sale approval authorization.",
);

assert(
  detail.includes(
    "Satışı Onayla",
  ),
  "Sale detail must expose Satışı Onayla.",
);

assert(
  detail.includes(
    'status === "ONAYLANDI" &&',
  ) &&
    detail.includes(
      'persistedSale.status === "TASLAK"',
    ) &&
    detail.includes(
      'persistedSale.status === "TEKLİF"',
    ),
  "Draft/offer ONAYLANDI transition must remain explicit in source.",
);

console.log(
  "PAK: sales approval visible actions contract suite",
);
