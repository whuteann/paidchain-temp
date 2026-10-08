import assert from "node:assert/strict";
import { test } from "node:test";
import { sortRows, toggleSort } from "../lib/table-sort.ts";

test("toggle ascending/descending and reset direction when changing columns", () => {
  const first = toggleSort(null, "name");
  assert.deepEqual(first, { key: "name", direction: "asc" });
  const second = toggleSort(first, "name");
  assert.deepEqual(second, { key: "name", direction: "desc" });
  assert.deepEqual(toggleSort(second, "name"), first);
  assert.deepEqual(toggleSort(second, "amount"), { key: "amount", direction: "asc" });
});

test("sort raw numeric amounts with stable ties without mutating input", () => {
  const rows = [{ id: "a", amount: 10 }, { id: "b", amount: 2 }, { id: "c", amount: -1 }, { id: "d", amount: 2 }];
  assert.deepEqual(sortRows(rows, { key: "amount", direction: "asc" }, (r) => r.amount).map((r) => r.id), ["c", "b", "d", "a"]);
  assert.deepEqual(sortRows(rows, { key: "amount", direction: "desc" }, (r) => r.amount).map((r) => r.id), ["a", "b", "d", "c"]);
  assert.deepEqual(rows.map((r) => r.id), ["a", "b", "c", "d"]);
});

test("missing values stay last, while zero and false remain sortable", () => {
  const rows = [null, 0, undefined, 10, NaN].map((value) => ({ value }));
  assert.deepEqual(sortRows(rows, { key: "value", direction: "asc" }, (r) => r.value).map((r) => r.value), [0, 10, null, undefined, NaN]);
  assert.deepEqual(sortRows(rows, { key: "value", direction: "desc" }, (r) => r.value).map((r) => r.value), [10, 0, null, undefined, NaN]);
  assert.deepEqual(sortRows([true, false, null], { key: "value", direction: "asc" }, (r) => r), [false, true, null]);
});

test("text is case insensitive and dates include the year", () => {
  assert.deepEqual(sortRows(["zebra", "Alpha", "alpha", "", "Beta"], { key: "value", direction: "asc" }, (r) => r), ["Alpha", "alpha", "Beta", "zebra", ""]);
  assert.deepEqual(sortRows(["2026-01-01", "2025-12-31", "2026-02-01"], { key: "value", direction: "asc" }, (r) => r), ["2025-12-31", "2026-01-01", "2026-02-01"]);
});

test("default and action columns retain the server's order", () => {
  const rows = [3, 1, 2];
  assert.equal(sortRows(rows, null, (r) => r), rows);
  assert.equal(sortRows(rows, { key: "actions", direction: "asc" }), rows);
});
