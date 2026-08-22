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

const sidebar = fs.readFileSync(
  path.join(
    root,
    "src/components/Sidebar.tsx",
  ),
  "utf8",
);

const saleReturn = fs.readFileSync(
  path.join(
    root,
    "src/app/satis-iade/page.tsx",
  ),
  "utf8",
);

for (const label of [
  "Satış",
  "Satış İade",
  "Alış",
  "Alış İade",
  "Raporlar",
]) {
  assert(
    sidebar.includes(label),
    `Faturalar submenu label missing: ${label}`,
  );
}

assert(
  sidebar.includes(
    '{ name: "Alış", href: "/alis", enabled: false }',
  ),
  "Alış must remain disabled until source authority is complete.",
);

assert(
  sidebar.includes(
    '{ name: "Alış İade", href: "/alis-iade", enabled: false }',
  ),
  "Alış İade must remain disabled until source authority is complete.",
);

assert(
  saleReturn.includes(
    "loadLocalSaleReturns(scope)",
  ),
  "Satış İade route must read the canonical scoped local return store.",
);

assert(
  saleReturn.includes(
    "saleReturn.saleId",
  ),
  "Satış İade route must preserve source sale identity.",
);

assert(
  saleReturn.includes(
    "saleReturn.customerId",
  ),
  "Satış İade route must preserve customer identity.",
);

console.log(
  "PAK: faturalar submenu and sale return route suite",
);
