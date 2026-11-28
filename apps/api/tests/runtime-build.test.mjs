import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { zipSync, strToU8 } from "fflate";
import { BuildBroker, RuntimeError } from "../src/runtime/broker.ts";
import { D1BuildStore } from "../src/runtime/store.ts";
import { handleRuntime } from "../src/runtime/api.ts";
const sha = "a".repeat(40),
  definition = "c".repeat(40),
  blob = "d".repeat(40),
  idem = "12345678-1234-4234-8234-123456789abc";
const target = {
  id: "agent",
  workspaceId: "workspace",
  repository: "rodkisten/rodsandbox",
  workflowFile: ".github/workflows/runtime-build.yml",
  workflowRef: "main",
  workflowBlobSha: blob,
  imageRepository: "ghcr.io/rodkisten/rodsandbox/agent",
  subjects: ["owner@example.test"],
  platforms: ["linux/amd64"],
};
const input = {
  schemaVersion: 1,
  workspaceId: "workspace",
  targetId: "agent",
  sourceSha: sha,
  idempotencyKey: idem,
};
async function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    await readFile(
      new URL("../migrations/0003_runtime_builds.sql", import.meta.url),
      "utf8",
    ),
  );
  const d1 = {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        async run() {
          return { meta: { changes: db.prepare(sql).run(...values).changes } };
        },
        async first() {
          return db.prepare(sql).get(...values) ?? null;
        },
        async all() {
          return { results: db.prepare(sql).all(...values) };
        },
      };
    },
  };
  const store = new D1BuildStore(d1),
    calls = [];
  let comparison = "behind",
    timeout = false,
    redirect =
      "https://productionresultssa1.blob.core.windows.net/results/artifact.zip?sig=fixture",
    resultFields = {},
    downloadCalls = 0;
  let createdId;
  const api = async (path, init = {}) => {
    calls.push({ path, method: init.method ?? "GET" });
    if (path.includes("/contents/")) return Response.json({ sha: blob });
    if (path.includes("/compare/"))
      return Response.json({ status: comparison });
    if (path.endsWith("/dispatches")) {
      createdId = JSON.parse(init.body).inputs.request_id;
      if (timeout) throw Error("Timeout after server accepted dispatch");
      return Response.json({ workflow_run_id: 42 });
    }
    if (path.includes("/runs?"))
      return Response.json({
        workflow_runs: [
          {
            id: 42,
            event: "workflow_dispatch",
            display_title: "RodSandbox build " + createdId,
          },
        ],
      });
    if (path.endsWith("/actions/runs/42"))
      return Response.json({
        id: 42,
        event: "workflow_dispatch",
        path: target.workflowFile,
        head_sha: definition,
        status: "completed",
        conclusion: "success",
        run_attempt: 1,
        repository: { full_name: target.repository },
      });
    if (path.includes("/artifacts?"))
      return Response.json({
        artifacts: [
          {
            id: 7,
            name: "rod-build-" + createdId + "-attempt-1",
            size_in_bytes: 500,
            expired: false,
          },
        ],
      });
    if (path.endsWith("/zip"))
      return new Response(null, {
        status: 302,
        headers: { location: redirect },
      });
    throw Error("Unexpected request " + path);
  };
  const download = async (url, init) => {
    downloadCalls++;
    assert.equal(init.credentials, undefined);
    assert.equal(init.redirect, "error");
    assert.equal(init.headers, undefined);
    return new Response(
      zipSync({
        "runtime-build-result.json": strToU8(
          JSON.stringify({
            schemaVersion: 1,
            requestId: createdId,
            workspaceId: "workspace",
            targetId: "agent",
            repository: target.repository,
            sourceSha: sha,
            workflowSha: definition,
            workflowFile: target.workflowFile,
            runId: 42,
            runAttempt: 1,
            imageRepository: target.imageRepository,
            digest: "sha256:" + "b".repeat(64),
            platforms: ["linux/amd64"],
            ...resultFields,
          }),
        ),
      }),
    );
  };
  return {
    store,
    broker: new BuildBroker(store, api, download),
    calls,
    d1,
    close: () => db.close(),
    setComparison: (v) => (comparison = v),
    setTimeout: () => (timeout = true),
    setResult: (v) => (resultFields = v),
    setRedirect: (v) => (redirect = v),
    downloads: () => downloadCalls,
  };
}
test("D1 reservation prevents concurrent duplicate dispatch and rejects changed-source reuse", async () => {
  const s = await setup();
  try {
    const results = await Promise.all([
      s.broker.create(input, target.subjects[0], [target]),
      s.broker.create(input, target.subjects[0], [target]),
    ]);
    assert.equal(results[0].id, results[1].id);
    assert.equal(s.calls.filter((c) => c.method === "POST").length, 1);
    await assert.rejects(
      () =>
        s.broker.create(
          { ...input, sourceSha: "f".repeat(40) },
          target.subjects[0],
          [target],
        ),
      (e) => e.status === 409,
    );
  } finally {
    s.close();
  }
});
test("denied workspace and uncommitted source never reach workflow dispatch", async () => {
  const s = await setup();
  try {
    await assert.rejects(
      () => s.broker.create(input, "attacker", [target]),
      (e) => e.status === 404,
    );
    assert.equal(s.calls.length, 0);
    s.setComparison("ahead");
    await assert.rejects(
      () => s.broker.create(input, target.subjects[0], [target]),
      (e) => e.status === 422,
    );
    assert.equal(s.calls.filter((c) => c.method === "POST").length, 0);
  } finally {
    s.close();
  }
});
test("ambiguous dispatch is not retried and can reconcile its exact named run", async () => {
  const s = await setup();
  try {
    s.setTimeout();
    const first = await s.broker.create(input, target.subjects[0], [target]);
    assert.equal(first.status, "dispatch_unknown");
    await s.broker.create(input, target.subjects[0], [target]);
    assert.equal(s.calls.filter((c) => c.method === "POST").length, 1);
    const finished = await s.broker.get(first.id, target.subjects[0], [target]);
    assert.equal(finished.status, "succeeded");
    assert.equal(finished.result.sourceSha, sha);
    assert.equal(
      finished.runUrl,
      "https://github.com/rodkisten/rodsandbox/actions/runs/42",
    );
    assert.equal(s.downloads(), 1);
    assert.ok(!JSON.stringify(finished).includes("subjects"));
  } finally {
    s.close();
  }
});
test("artifact and target provenance reject substituted images and revoked grants", async () => {
  const s = await setup();
  try {
    const first = await s.broker.create(input, target.subjects[0], [target]);
    s.setResult({ sourceSha: "e".repeat(40) });
    await assert.rejects(
      () => s.broker.get(first.id, target.subjects[0], [target]),
      (e) => e.status === 502,
    );
    await assert.rejects(
      () => s.broker.get(first.id, "revoked", [target]),
      (e) => e.status === 404,
    );
  } finally {
    s.close();
  }
});
test("artifact download rejects untrusted redirects without forwarding credentials", async () => {
  const s = await setup();
  try {
    const first = await s.broker.create(input, target.subjects[0], [target]);
    s.setRedirect("https://attacker.invalid/artifact");
    await assert.rejects(
      () => s.broker.get(first.id, target.subjects[0], [target]),
      (e) => e.status === 502,
    );
    assert.equal(s.downloads(), 0);
  } finally {
    s.close();
  }
});
test("runtime API fails closed and never accepts browser or forged machine identity", async () => {
  const secret = "fixture-runtime-token-".repeat(3),
    env = {
      ORB_RUNTIME_TOKEN: secret,
      ORB_RUNTIME_POLICY: JSON.stringify({
        schemaVersion: 1,
        targets: [target],
      }),
      ORB_DB: {},
    };
  const send = (headers = {}, bindings = env) =>
    handleRuntime(
      new Request(
        "https://api.orb.migos.club/v1/runtime/targets?workspaceId=workspace",
        { headers },
      ),
      bindings,
    );
  assert.equal((await send()).status, 401);
  assert.equal(
    (
      await send({
        authorization: "Bearer " + secret,
        "x-rod-subject": target.subjects[0],
        origin: "https://manage.migos.club",
      })
    ).status,
    403,
  );
  const response = await send({
    authorization: "Bearer " + secret,
    "x-rod-subject": target.subjects[0],
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).targets.length, 1);
  assert.equal((await send({}, {})).status, 503);
});
