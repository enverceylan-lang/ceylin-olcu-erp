import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parsePlicellPieceInput } from "../src/lib/plicellPieceInput";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "src", "app", "cariler", "[id]", "page.tsx"), "utf8");
const editor = fs.readFileSync(path.join(root, "src", "components", "measurements", "PlicellCamListEditor.tsx"), "utf8");

assert.match(page, /const \[selectedTemplate, setSelectedTemplate\] = useState\("SIMPLE_WIDTH_HEIGHT"\);/);
assert.doesNotMatch(page, /const \[selectedTemplate, setSelectedTemplate\] = useState\("CURTAIN_DETAIL"\);/);
assert.match(page, /setSelectedTemplate\(\s*"SIMPLE_WIDTH_HEIGHT"\s*\);/);
assert.match(page, /setSelectedTemplate\("SIMPLE_WIDTH_HEIGHT"\);/);
assert.match(page, /pendingPlicellPieceInput/);
assert.match(page, /selectedTemplate === 'PLICELL' &&\s*pendingPlicellPieceInput\.trim\(\)/);
assert.match(page, /onPendingPieceInputChange=\{setPendingPlicellPieceInput\}/);

assert.match(editor, /onPendingPieceInputChange\?: \(value: string\) => void;/);
assert.match(editor, /function handleGeneratePieces\(\s*inputValue = fastInput,\s*announceErrors = true,\s*\): void/);
assert.match(editor, /result\.pieces\.length === 0 \|\|\s*result\.errors\.length > 0/);
assert.match(editor, /handleGeneratePieces\(\s*nextValue,\s*false,\s*\);/);
assert.match(editor, /emitCombined\(\s*nextPieceRows,\s*commonRows,\s*\);/);

const parsed = parsePlicellPieceInput(["40x150","41x151","42x152","43x153","44x154"].join("\n"));
assert.equal(parsed.errors.length, 0);
assert.equal(parsed.pieces.length, 5);
console.log("[PASS] plicellMixedGroupMeasurementAuthoritySuite completed");
