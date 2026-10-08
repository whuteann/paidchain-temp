import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as sorting from "../lib/table-sort.ts";

// Compile the actual TSX component with the project's installed compiler.
// No browser, database, or extra test runtime is needed for these render checks.
const filename = fileURLToPath(new URL("../components/table-sorting.tsx", import.meta.url));
const component = new Module(filename);
const require = createRequire(filename);
component.require = (id) => id === "@/lib/table-sort" ? sorting : require(id);
component._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { SortableTable } = component.exports;
const columns = [
  { key: "name", header: "Name", sortValue: (row) => row.name },
  { key: "actions", header: "Actions" },
];
const rows = [{ name: "Zulu" }, { name: "Alpha" }];
const children = (displayed, headers) => React.createElement("table", null,
  React.createElement("thead", null, React.createElement("tr", null, headers)),
  React.createElement("tbody", null, displayed.map((row) => React.createElement("tr", { key: row.name }, React.createElement("td", null, row.name)))));

function render(props) {
  return renderToStaticMarkup(React.createElement(SortableTable, { rows, columns, children, ...props }));
}

test("headers expose sorting state, keyboard buttons, and a mobile selector", () => {
  const html = render({ sort: { key: "name", direction: "asc" } });
  assert.match(html, /aria-sort="ascending"/);
  assert.match(html, /<button type="button"[^>]*aria-label="Sort by Name, descending"/);
  assert.match(html, /<th scope="col">Actions<\/th>/);
  assert.match(html, /table-mobile-sort/);
  assert.match(html, /<option value="name" selected="">Name<\/option>/);
  assert.ok(html.indexOf("<td>Alpha</td>") < html.indexOf("<td>Zulu</td>"));
});

test("server sorting leaves the received rows in their global order", () => {
  const html = render({ sort: { key: "name", direction: "asc" }, onSortChange() {} });
  assert.ok(html.indexOf("<td>Zulu</td>") < html.indexOf("<td>Alpha</td>"));
});

test("descending headers announce the next action and empty tables still render controls", () => {
  const html = render({ rows: [], sort: { key: "name", direction: "desc" } });
  assert.match(html, /aria-sort="descending"/);
  assert.match(html, /aria-label="Sort by Name, ascending"/);
  assert.match(html, /Default order/);
});
