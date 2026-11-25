type Run = {
  id: number
  name: string
  status: string
  conclusion: string | null
  created_at: string
  pull_requests: { number: number }[]
}

type Job = {
  id: number
  name: string
  conclusion: string | null
  steps?: { name: string; number: number; conclusion: string | null }[]
}

export function latestPrRun(runs: Run[], number: number) {
  return runs
    .filter(run => run.pull_requests.some(pr => pr.number === number))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)[0]
}

export async function readPrFailure(owner: string, repo: string, number: number, token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'orb-api',
  }
  const query = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      query: 'query($owner:String!, $repo:String!, $number:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { headRefOid } } }',
      variables: { owner, repo, number },
    }),
  })
  if (!query.ok) throw new Error('GitHub GraphQL request failed')
  const result = await query.json<{
    errors?: unknown[]
    data?: { repository?: { pullRequest?: { headRefOid: string } } }
  }>()
  if (result.errors?.length) throw new Error('GitHub GraphQL query failed')
  const sha = result.data?.repository?.pullRequest?.headRefOid
  if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) return { failure: null }

  const root = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  async function rest<T>(path: string) {
    const response = await fetch(root + path, { headers, signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('GitHub REST request failed')
    return response.json<T>()
  }
  const { workflow_runs } = await rest<{ workflow_runs: Run[] }>(
    `/actions/runs?head_sha=${sha}&event=pull_request&per_page=100`,
  )
  const run = latestPrRun(workflow_runs, number)
  if (run?.status !== 'completed' || run.conclusion !== 'failure') return { failure: null }

  const { jobs } = await rest<{ jobs: Job[] }>(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100`)
  const failedJob = jobs.find(job => job.conclusion === 'failure')
  const step = failedJob?.steps?.find(item => item.conclusion === 'failure')
  const annotations = failedJob
    ? await rest<{ annotation_level: string; message: string }[]>(
        `/check-runs/${failedJob.id}/annotations?per_page=30`,
      ).catch(() => [])
    : []
  const error = annotations.find(item => item.annotation_level === 'failure')?.message.slice(0, 2000) ?? null
  const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${run.id}`
  return {
    failure: {
      workflow: run.name,
      job: failedJob?.name ?? null,
      step: step?.name ?? null,
      error,
      runUrl,
      logUrl: failedJob
        ? `${runUrl}/job/${failedJob.id}${step ? `#step:${step.number}:1` : ''}`
        : runUrl,
    },
  }
}
