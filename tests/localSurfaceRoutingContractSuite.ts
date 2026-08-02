import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(
  relative: string,
): string {
  return fs.readFileSync(
    path.join(root, relative),
    "utf8",
  );
}

const packageJson =
  read("package.json");
const nextConfig =
  read("next.config.ts");
const proxy =
  read("src/proxy.ts");
const shell =
  read(
    "src/components/AppRouteShell.tsx",
  );
const platformPage =
  read(
    "src/app/platform/page.tsx",
  );
const launcher =
  read(
    "scripts/dev-surface.cjs",
  );

assert.match(
  packageJson,
  /"dev"\s*:\s*"node scripts\/dev-surface\.cjs company"/,
);
assert.match(
  packageJson,
  /"dev:company"\s*:\s*"node scripts\/dev-surface\.cjs company"/,
);
assert.match(
  packageJson,
  /"dev:platform"\s*:\s*"node scripts\/dev-surface\.cjs platform"/,
);

assert.match(
  launcher,
  /port:\s*"3001"/,
);
assert.match(
  launcher,
  /port:\s*"3002"/,
);
assert.match(
  launcher,
  /ENVERP_LOCAL_SURFACE/,
);
assert.match(
  launcher,
  /ENVERP_LOCAL_COMPANY_SLUG/,
);

assert.match(
  nextConfig,
  /\.next\/company/,
);
assert.match(
  nextConfig,
  /\.next\/platform/,
);

assert.match(
  proxy,
  /decideLocalSurfaceRequest/,
);
assert.match(
  proxy,
  /"\/api\/:path\*"/,
);

assert.match(
  shell,
  /isPlatformRoute/,
);
assert.match(
  shell,
  /"platform"/,
);

assert.match(
  platformPage,
  /PLATFORM_SUPER_ADMIN/,
);
assert.match(
  platformPage,
  /\/super-admin/,
);

console.log(
  "LOCAL_SURFACE_ROUTING_CONTRACT: PAK",
);