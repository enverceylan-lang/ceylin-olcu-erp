import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync("src/app/finans/page.tsx","utf8");

assert.match(source,/const syncSection = \(\) => \{/);
assert.match(source,/addEventListener\("hashchange", syncSection\)/);
assert.match(source,/addEventListener\("popstate", syncSection\)/);
assert.match(source,/addEventListener\("enverp:finance-section-change", syncSection\)/);
assert.match(source,/removeEventListener\("enverp:finance-section-change", syncSection\)/);

assert.match(source,/let lastHash = window\.location\.hash/);
assert.match(source,/window\.location\.hash === lastHash/);
assert.match(source,/window\.setInterval\(\(\) => \{/);
assert.match(source,/window\.clearInterval\(hashObserver\)/);

assert.match(source,/window\.history\.pushState\(null, "", nextUrl\)/);
assert.match(source,/window\.dispatchEvent\(new Event\("enverp:finance-section-change"\)\)/);
assert.match(source,/setActiveSection\(section\)/);

console.log("FINANCE_HASH_STATE_NAVIGATION_REGRESSION: PAK");