const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = fs.readFileSync(path.resolve(__dirname, '../src/lib/finance/financeSystemWorkflowApiHandler.ts'), 'utf8');
const catchBlock = file.slice(file.indexOf('  catch (error: unknown) {'));
assert.ok(catchBlock.startsWith('  catch (error: unknown) {'), 'expected catch block missing');
assert.match(catchBlock, /FINANCE_SYSTEM_WORKFLOW_FAILURE/);
assert.match(catchBlock, /failureClass/);
assert.match(catchBlock, /status:\s*500/);
assert.match(catchBlock, /"SYSTEM_WORKFLOW_PERSISTENCE_FAILED"/);
assert.doesNotMatch(catchBlock, /console\.(?:log|error|warn)\s*\([^)]*error(?:\.message|\.stack)?\b/s, 'raw exception must not be logged');
assert.doesNotMatch(catchBlock, /console\.(?:log|error|warn)\s*\([^)]*(?:scope|actor|source|transaction)\b/s);
for (const label of ['RPC_REJECTED','RPC_RESULT_INVALID','RPC_TRANSACTION_ID_MISSING','RPC_RESPONSE_INVALID','UNKNOWN']) {
  assert.ok(catchBlock.includes('"' + label + '"'), `missing allowlisted class ${label}`);
}
process.stdout.write('FINANCE_ERROR_VISIBILITY_SOURCE_CONTRACT=PAK\\n');