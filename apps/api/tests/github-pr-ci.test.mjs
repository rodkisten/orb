import assert from "node:assert/strict";
import test from "node:test";
import { readPrFailure } from "../src/github-pr-ci.ts";
import { ciPage } from "../src/github-pr-ci-page.ts";

const runUrl =
  "https://github.com/rodkisten/userscripts-cf/actions/runs/45515942750";
const jobUrl = runUrl + "/job/138873543304";
const failed = {
  status: "COMPLETED",
  conclusion: "FAILURE",
  workflowRun: {
    url: runUrl,
    event: "pull_request",
    createdAt: "2026-11-24T20:00:00Z",
    workflow: { name: "Build" },
  },
  checkRuns: {
    nodes: [
      {
        name: "Bundle",
        status: "COMPLETED",
        conclusion: "FAILURE",
        detailsUrl: jobUrl,
        steps: {
          nodes: [{ name: "Typecheck", number: 4, conclusion: "FAILURE" }],
        },
        annotations: {
          nodes: [
            { annotationLevel: "FAILURE", message: "<script>unsafe</script>" },
          ],
        },
      },
    ],
  },
};

test("uses large Actions URLs, hides stale failures and renders a safe standalone page", async (t) => {
  let suites = [failed];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.doesNotMatch(JSON.parse(init.body).query, /databaseId/);
    return Response.json({
      data: {
        repository: {
          pullRequest: {
            commits: {
              nodes: [
                {
                  commit: {
                    oid: "a".repeat(40),
                    checkSuites: { nodes: suites },
                  },
                },
              ],
            },
          },
        },
      },
    });
  });
  const read = () =>
    readPrFailure("rodkisten", "userscripts-cf", 146, "fixture");
  const result = await read();
  assert.equal(result.failure.logUrl, jobUrl + "#step:4:1");
  const response = ciPage("userscripts-cf #146", result);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const markup = await response.text();
  assert.match(markup, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<script>/);

  for (const [status, conclusion] of [
    ["COMPLETED", "SUCCESS"],
    ["IN_PROGRESS", null],
  ]) {
    suites = [
      failed,
      {
        ...failed,
        status,
        conclusion,
        workflowRun: {
          ...failed.workflowRun,
          createdAt: "2026-11-24T21:00:00Z",
        },
      },
    ];
    assert.deepEqual(await read(), { failure: null });
  }
});
