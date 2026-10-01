/**
 * The NestJS integration, run by Node's test runner against the built
 * entry, so it works with NestJS 12 (ESM only) as with NestJS 11: Jest's
 * module loader cannot load ESM-only packages from CommonJS.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { beforeEach, describe, it } from "node:test";
import { Test } from "@nestjs/testing";

const require = createRequire(import.meta.url);
const { CascadeModule, CascadeService } = require("../dist/integrations/nestjs.js");
const { InvalidationScope, InvalidationStrategy } = require("../dist/index.js");

class MockEntity {
  constructor(id, name, __typename = "MockEntity") {
    this.id = id;
    this.name = name;
    this.__typename = __typename;
  }

  toDict() {
    return { id: String(this.id), name: this.name };
  }
}

const resolveService = async (imports) =>
  (await Test.createTestingModule({ imports }).compile()).resolve(CascadeService);

describe("CascadeModule.forRoot", () => {
  it("passes the invalidator and updated fields through", async () => {
    const hint = {
      queryName: "todos",
      strategy: InvalidationStrategy.INVALIDATE,
      scope: InvalidationScope.EXACT,
    };
    const service = await resolveService([
      CascadeModule.forRoot({ invalidator: { computeInvalidations: () => [hint] } }),
    ]);
    service.startTransaction();
    service.trackUpdate(
      { __typename: "Todo", id: "1", title: "A" },
      { updatedFields: ["title"] },
    );

    const response = service.buildResponse(null);

    assert.deepEqual(response.cascade.invalidations, [hint]);
    assert.deepEqual(response.cascade.updated[0].updatedFields, ["title"]);
  });

  it("applies the tracker and builder options", async () => {
    const service = await resolveService([
      CascadeModule.forRoot({ maxDepth: 5, excludeTypes: ["Internal"], maxResponseSizeMb: 10 }),
    ]);
    service.startTransaction();
    service.trackUpdate({ __typename: "Internal", id: "1" });

    assert.deepEqual(service.buildResponse(null).cascade.updated, []);
  });
});

describe("CascadeService", () => {
  let service;

  beforeEach(async () => {
    service = await (
      await Test.createTestingModule({ providers: [CascadeService] }).compile()
    ).resolve(CascadeService);
  });

  it("holds a tracker and a builder", () => {
    assert.ok(service.getTracker());
    assert.ok(service.getBuilder());
  });

  it("tracks created, updated and deleted entities", () => {
    service.startTransaction();
    service.trackCreate(new MockEntity(1, "Created"));
    service.trackUpdate(new MockEntity(2, "Updated"));
    service.trackDelete("MockEntity", "3");

    const { updated, deleted } = service.getCascadeData();

    assert.deepEqual(
      updated.map((u) => [u.id, u.operation, u.entity.name]),
      [
        ["1", "CREATED", "Created"],
        ["2", "UPDATED", "Updated"],
      ],
    );
    assert.deepEqual(
      deleted.map((d) => [d.typename, d.id]),
      [["MockEntity", "3"]],
    );
    service.endTransaction();
  });

  it("builds success responses and ends the transaction", () => {
    service.startTransaction();
    service.trackCreate(new MockEntity(1, "Created"));

    const response = service.buildResponse({ id: 1 });

    assert.equal(response.success, true);
    assert.deepEqual(response.data, { id: 1 });
    assert.equal(response.cascade.updated.length, 1);
    assert.deepEqual(response.errors, []);
    assert.throws(() => service.getCascadeData());
  });

  it("builds error responses", () => {
    service.startTransaction();
    const errors = [{ message: "Test error", code: "TEST_ERROR" }];

    const response = service.buildErrorResponse(errors);

    assert.equal(response.success, false);
    assert.deepEqual(response.errors, errors);
  });

  it("refuses a second transaction", () => {
    assert.match(service.startTransaction(), /^cascade_/);
    assert.throws(() => service.startTransaction(), /Transaction already in progress/);
  });
});

describe("CascadeModule", () => {
  it("provides a CascadeService per resolution scope", async () => {
    const module = await Test.createTestingModule({ imports: [CascadeModule] }).compile();
    const first = await module.resolve(CascadeService);
    const second = await module.resolve(CascadeService);

    assert.ok(first instanceof CascadeService);
    first.startTransaction();
    first.trackCreate(new MockEntity(1, "First"));
    second.startTransaction();
    second.trackCreate(new MockEntity(2, "Second"));

    assert.deepEqual(first.getCascadeData().updated.map((u) => u.entity.name), ["First"]);
    assert.deepEqual(second.getCascadeData().updated.map((u) => u.entity.name), ["Second"]);
  });
});
