import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import yaml from "js-yaml";
import pino from "pino";
import { createApp } from "./app.js";
import { createEventStore } from "./store.js";
import { DEFAULT_OPENAPI_PATH } from "./routes/docs.js";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

const silentLog = pino({ level: "silent" });

/** Converts an Express layer's mount regexp back into a path prefix. */
function mountPath(layer) {
  if (layer.regexp.fast_slash) return "";
  return layer.regexp.source
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    .replace(/\\\//g, "/");
}

function collectRoutes(stack, prefix = "", found = new Set()) {
  for (const layer of stack) {
    if (layer.route) {
      const routePath = (prefix + layer.route.path)
        .replace(/:([A-Za-z0-9_]+)/g, "{$1}")
        .replace(/(.)\/$/, "$1");
      for (const method of Object.keys(layer.route.methods)) {
        found.add(`${method.toUpperCase()} ${routePath}`);
      }
    } else if (layer.name === "router" && layer.handle.stack) {
      collectRoutes(layer.handle.stack, prefix + mountPath(layer), found);
    }
  }
  return found;
}

function collectSpecOperations(spec) {
  const found = new Set();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      if (item[method]) found.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return found;
}

describe("OpenAPI spec vs registered routes", () => {
  const client = { readContract: async () => null };
  const clients = {
    vault: { client, contractId: "C-VAULT" },
    stream: { client, contractId: "C-STREAM" },
    dca: { client, contractId: "C-DCA" },
  };
  const app = createApp(clients, silentLog, createEventStore("memory"));
  const spec = yaml.load(fs.readFileSync(DEFAULT_OPENAPI_PATH, "utf8"));

  const registered = collectRoutes(app._router.stack);
  const documented = collectSpecOperations(spec);

  it("finds the routes the app registers", () => {
    // Guards the walker itself: if Express internals change this must not silently pass.
    assert.ok(registered.has("GET /healthz"));
    assert.ok(registered.has("GET /api/stream"));
    assert.ok(registered.has("GET /api/dca/{address}/{id}/history"));
    assert.ok(registered.size >= 10);
  });

  it("documents every registered route", () => {
    const missing = [...registered].filter((r) => !documented.has(r)).sort();
    assert.deepStrictEqual(missing, [], `routes missing from openapi.yaml: ${missing.join(", ")}`);
  });

  it("does not document routes the app does not serve", () => {
    const extra = [...documented].filter((r) => !registered.has(r)).sort();
    assert.deepStrictEqual(extra, [], `spec paths without a route: ${extra.join(", ")}`);
  });

  it("uses unique operationIds", () => {
    const ids = Object.values(spec.paths).flatMap((item) =>
      HTTP_METHODS.filter((m) => item[m]).map((m) => item[m].operationId),
    );
    assert.ok(ids.every(Boolean), "every operation needs an operationId");
    assert.strictEqual(new Set(ids).size, ids.length);
  });

  it("documents the SSE content type and the history query parameters and errors", () => {
    const sse = spec.paths["/api/stream"].get.responses["200"].content;
    assert.ok(sse["text/event-stream"]);

    const history = spec.paths["/api/dca/{address}/{id}/history"].get;
    const params = history.parameters.map((p) => p.name ?? p.$ref);
    assert.ok(params.includes("start"));
    assert.ok(params.includes("limit"));
    assert.ok(history.responses["400"]);
    assert.ok(history.responses["404"]);
  });

  it("resolves every $ref in the spec", () => {
    const text = fs.readFileSync(DEFAULT_OPENAPI_PATH, "utf8");
    const refs = [...text.matchAll(/\$ref: "#\/([^"]+)"/g)].map((m) => m[1].split("/"));
    for (const ref of refs) {
      let node = spec;
      for (const part of ref) node = node?.[part];
      assert.ok(node, `unresolved $ref #/${ref.join("/")}`);
    }
  });
});
