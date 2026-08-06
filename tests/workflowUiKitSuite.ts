import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  readinessTone,
  riskTone,
  toWorkflowEvent,
  type WorkflowEvent
} from "../src/lib/workflowUiKit";

test("readiness tone is semantic and deterministic", () => {
  assert.equal(readinessTone("BLOCKED"), "CRITICAL");
  assert.equal(readinessTone("WAITING"), "PLANNED");
  assert.equal(readinessTone("READY"), "POSITIVE");
  assert.equal(readinessTone("COMPLETE"), "POSITIVE");
  assert.equal(readinessTone("CLOSED"), "CLOSED");
});

test("risk tone is semantic and deterministic", () => {
  assert.equal(riskTone("LOW"), "NEUTRAL");
  assert.equal(riskTone("MEDIUM"), "WARNING");
  assert.equal(riskTone("HIGH"), "CRITICAL");
});

test("workflow event remains a presentation contract, not a domain status engine", () => {
  const event: WorkflowEvent = {
    id: "event-1",
    label: "Ãœretime alÄ±ndÄ±",
    at: "2026-08-07T01:00:00.000Z",
    tone: "IN_PROGRESS"
  };

  assert.equal(event.id, "event-1");
  assert.equal(event.tone, "IN_PROGRESS");
});
test("operation timeline projection adapts without inventing domain state", () => {
  const event = toWorkflowEvent({
    code: "CREATED",
    label: "Oluşturuldu",
    occurredAt: "2026-08-07T01:00:00.000Z"
  });

  assert.deepEqual(event, {
    id: "CREATED:2026-08-07T01:00:00.000Z",
    label: "Oluşturuldu",
    at: "2026-08-07T01:00:00.000Z"
  });
});
test("shared assignment presentation preserves operations assignment semantics", () => {
  const componentSource = readFileSync(
    "src/components/workflow/WorkflowUiKit.tsx",
    "utf8"
  );

  assert.match(componentSource, /D\u0131\u015f Partner/);
  assert.match(componentSource, /\u015eirket \u0130\u00e7i/);
});