export type PreviewStatus = "building" | "ready" | "failed" | "removed";

export interface PreviewDeployment {
  project: string;
  pr_number: number;
  repository: string;
  hostname: string;
  sha: string;
  status: PreviewStatus;
  upstream: string | null;
  run_id: string;
  updated_at: number;
}

export function previewHostname(project: string, pr: number): string {
  if (
    !/^[a-z][a-z0-9-]{0,39}$/.test(project) ||
    !Number.isSafeInteger(pr) ||
    pr < 1 ||
    pr > 999999999
  ) {
    throw new Error("Invalid preview identity");
  }
  return project + "-pr" + pr + ".migos.club";
}

export async function listPreviews(
  db: D1Database,
): Promise<PreviewDeployment[]> {
  const result = await db
    .prepare(
      "SELECT * FROM preview_deployments ORDER BY updated_at DESC LIMIT 200",
    )
    .all<PreviewDeployment>();
  return result.results;
}

export async function findPreview(
  db: D1Database,
  hostname: string,
): Promise<PreviewDeployment | null> {
  return db
    .prepare("SELECT * FROM preview_deployments WHERE hostname = ?")
    .bind(hostname.toLowerCase())
    .first<PreviewDeployment>();
}

export type PreviewUpdate = {
  project: string;
  pr: number;
  sha: string;
  runId: string;
  status: PreviewStatus;
};

// Pilot targets are derived, never accepted as arbitrary proxy URLs.
export async function updatePreview(
  db: D1Database,
  input: PreviewUpdate,
): Promise<boolean> {
  const hostname = previewHostname(input.project, input.pr);
  if (
    input.project !== "sandbox" ||
    !/^[a-f0-9]{40}$/.test(input.sha) ||
    !/^[1-9][0-9]{0,17}$/.test(input.runId)
  ) {
    throw new Error("Invalid preview update");
  }
  const upstream =
    input.status === "ready"
      ? "https://pr" + input.pr + ".sandbox.migos.club"
      : null;
  const result = await db
    .prepare(
      `
    INSERT INTO preview_deployments (project, pr_number, repository, hostname, sha, status, upstream, run_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project, pr_number) DO UPDATE SET
      sha=excluded.sha, status=excluded.status, upstream=excluded.upstream,
      run_id=excluded.run_id, updated_at=excluded.updated_at
    WHERE CAST(excluded.run_id AS INTEGER) > CAST(preview_deployments.run_id AS INTEGER)
      OR (excluded.run_id=preview_deployments.run_id AND excluded.sha=preview_deployments.sha
        AND (preview_deployments.status=excluded.status
          OR (preview_deployments.status='building' AND excluded.status IN ('ready','failed','removed'))
          OR (preview_deployments.status IN ('ready','failed') AND excluded.status='removed')))
  `,
    )
    .bind(
      input.project,
      input.pr,
      "rodkisten/rodsandbox",
      hostname,
      input.sha,
      input.status,
      upstream,
      input.runId,
      Date.now(),
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}
