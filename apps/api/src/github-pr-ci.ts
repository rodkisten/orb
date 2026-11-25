type GraphQLResponse<T> = {
  data?: T
  errors?: { message: string }[]
}

export type PrFailure = {
  workflow: string
  job: string | null
  step: string | null
  error: string | null
  runUrl: string
  logUrl: string
}

/**
 * Lightweight tagged template helper for GraphQL queries.
 * Normalizes whitespace for cleaner wire payloads and provides type inference.
 */
function createGitHubGraphQLClient(token: string, userAgent = 'orb-api') {
  return async function gql<TData, TVars extends Record<string, unknown> = Record<string, never>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<(variables?: TVars) => Promise<TData>> {
    const query = strings
      .reduce((acc, str, i) => acc + str + (values[i] ?? ''), '')
      .replace(/\s+/g, ' ')
      .trim()

    return async (variables?: TVars) => {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
        },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ query, variables }),
      })

      if (!response.ok) {
        throw new Error(`GitHub GraphQL HTTP ${response.status}: ${response.statusText}`)
      }

      const result = (await response.json()) as GraphQLResponse<TData>
      if (result.errors?.length) {
        throw new Error(`GitHub GraphQL Error: ${result.errors.map(e => e.message).join('; ')}`)
      }
      if (!result.data) {
        throw new Error('GitHub GraphQL returned empty data')
      }

      return result.data
    }
  }
}

type PrCheckQueryData = {
  repository: {
    pullRequest: {
      commits: {
        nodes: {
          commit: {
            oid: string
            checkSuites: {
              nodes: {
                workflowRun: {
                  databaseId: number
                  createdAt: string
                  event: string
                  workflow: { name: string }
                } | null
                checkRuns: {
                  nodes: {
                    databaseId: number
                    name: string
                    status: string
                    conclusion: string | null
                    detailsUrl: string
                    steps: {
                      nodes: {
                        name: string
                        number: number
                        conclusion: string | null
                      }[]
                    }
                    annotations: {
                      nodes: {
                        annotationLevel: string
                        message: string
                      }[]
                    }
                  }[]
                }
              }[]
            }
          }
        }[]
      }
    } | null
  } | null
}

type PrCheckQueryVars = {
  owner: string
  repo: string
  number: number
}

export async function readPrFailure(
  owner: string,
  repo: string,
  number: number,
  token: string,
): Promise<{ failure: PrFailure | null }> {
  const gql = createGitHubGraphQLClient(token)

  const fetchPrChecks = await gql<PrCheckQueryData, PrCheckQueryVars>`
    query ReadPrFailure($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          commits(last: 1) {
            nodes {
              commit {
                oid
                checkSuites(last: 20) {
                  nodes {
                    workflowRun {
                      databaseId
                      createdAt
                      event
                      workflow {
                        name
                      }
                    }
                    checkRuns(first: 50) {
                      nodes {
                        databaseId
                        name
                        status
                        conclusion
                        detailsUrl
                        steps(first: 50) {
                          nodes {
                            name
                            number
                            conclusion
                          }
                        }
                        annotations(first: 20) {
                          nodes {
                            annotationLevel
                            message
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `

  const data = await fetchPrChecks({ owner, repo, number })
  const headCommit = data.repository?.pullRequest?.commits.nodes[0]?.commit
  if (!headCommit || !/^[0-9a-f]{40}$/i.test(headCommit.oid)) {
    return { failure: null }
  }

  // Filter for pull_request workflow runs and sort newest-first
  const prSuites = headCommit.checkSuites.nodes
    .filter(suite => suite.workflowRun?.event === 'pull_request')
    .sort((a, b) => {
      const runA = a.workflowRun!
      const runB = b.workflowRun!
      return runB.createdAt.localeCompare(runA.createdAt) || runB.databaseId - runA.databaseId
    })

  const latestSuite = prSuites[0]
  const workflowRun = latestSuite?.workflowRun
  if (!latestSuite || !workflowRun) return { failure: null }

  // Ensure the run has finished and has a failing check run (job)
  const isStillRunning = latestSuite.checkRuns.nodes.some(run => run.status !== 'COMPLETED')
  if (isStillRunning) return { failure: null }

  const failedJob = latestSuite.checkRuns.nodes.find(run => run.conclusion === 'FAILURE')
  if (!failedJob) return { failure: null }

  const failedStep = failedJob.steps.nodes.find(step => step.conclusion === 'FAILURE')
  const failureAnnotation = failedJob.annotations.nodes.find(
    item => item.annotationLevel === 'FAILURE',
  )

  const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${workflowRun.databaseId}`
  const logUrl = `${runUrl}/job/${failedJob.databaseId}${failedStep ? `#step:${failedStep.number}:1` : ''}`

  return {
    failure: {
      workflow: workflowRun.workflow.name,
      job: failedJob.name,
      step: failedStep?.name ?? null,
      error: failureAnnotation?.message.slice(0, 2000) ?? null,
      runUrl,
      logUrl,
    },
  }
}
