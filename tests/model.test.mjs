import { test } from "node:test";
import assert from "node:assert/strict";
import { percent, bytes, normalizeReport, unpackLive } from "../src/model.mjs";
test("usage stays finite for empty or invalid totals", () => {
  assert.equal(percent(2, 0), 0);
  assert.equal(percent(200, 100), 100);
  assert.equal(percent(-1, 100), 0);
  assert.equal(bytes(undefined), "—");
  assert.equal(bytes(1024), "1.0 KiB");
});
test("live nested report maps network directions and totals without losing zero values", () => {
  const r = normalizeReport({
    cpu: { usage: 0 },
    ram: { used: 512, total: 1024 },
    network: { up: 2, down: 3, totalUp: 4, totalDown: 5 },
  });
  assert.equal(r.cpu, 0);
  assert.equal(r.ram, 512);
  assert.equal(r.ram_total, 1024);
  assert.equal(r.net_in, 3);
  assert.equal(r.net_out, 2);
  assert.equal(r.net_total_down, 5);
});
test("online membership is independent of a last known report", () => {
  const result = unpackLive({
    status: "success",
    data: {
      online: ["a"],
      data: { a: { cpu: { usage: 10 } }, b: { cpu: { usage: 20 } } },
    },
  });
  assert.equal(result.online.has("b"), false);
  assert.equal(result.reports.b.cpu, 20);
  assert.throws(() => unpackLive({ status: "error" }));
});
