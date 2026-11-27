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
