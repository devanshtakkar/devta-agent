import assert from "node:assert/strict";
import { test } from "node:test";
import { CONNECTION_STAGES, Connection, type ConnectionStage } from "../src/models/Connection.js";
import { applyStage } from "../src/services/connections.js";

for (const stage of ["flaked", "declined", "taken"] as const) {
  test(`connections accept the ${stage} status`, () => {
    assert.ok(CONNECTION_STAGES.includes(stage));
    const connection = new Connection({
      uuid: `test-${stage}`,
      userId: "test-user",
      name: "Test connection",
      stage,
    });
    assert.equal(connection.validateSync(), undefined);
  });

  test(`manual status change to ${stage} records one timeline event`, () => {
    const connection: { stage: ConnectionStage; events: unknown[] } = {
      stage: "talking",
      events: [],
    };
    applyStage(connection, stage);
    assert.equal(connection.stage, stage);
    assert.equal(connection.events.length, 1);
    assert.ok(connection.events[0]);
    const event = connection.events[0] as {
      type: string;
      title: string;
      details: string;
      occurredAt: Date;
    };
    assert.equal(event.type, "stage_change");
    assert.equal(event.title, `Moved to ${stage}`);
    assert.equal(event.details, "Previously talking.");
    assert.ok(event.occurredAt instanceof Date);
    applyStage(connection, stage);
    assert.equal(connection.events.length, 1);
  });
}

test("editing basic details without a status change leaves the timeline alone", () => {
  const connection: { stage: ConnectionStage; events: unknown[] } = {
    stage: "contact",
    events: [],
  };
  applyStage(connection, undefined);
  applyStage(connection, "contact");
  assert.equal(connection.stage, "contact");
  assert.deepEqual(connection.events, []);
});

test("closed outcomes can be manually corrected to an active status", () => {
  const connection: { stage: ConnectionStage; events: unknown[] } = {
    stage: "flaked",
    events: [],
  };
  applyStage(connection, "talking");
  assert.equal(connection.stage, "talking");
  assert.equal(connection.events.length, 1);
});

test("connections still reject unrecognized statuses", () => {
  const connection = new Connection({
    uuid: "test-invalid",
    userId: "test-user",
    name: "Test connection",
    stage: "unknown",
  });
  assert.ok(connection.validateSync()?.errors.stage);
});
