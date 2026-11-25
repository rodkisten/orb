import assert from 'node:assert/strict'
import test from 'node:test'
import { readStepLog } from '../src/github-ci-log.ts'

const failure = {
  logUrl: 'https://github.com/rodkisten/userscripts-cf/actions/runs/45515942750/job/138873543304#step:4:1',
}

test('reads the failed step excerpt and keeps the token on api.github.com', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++
    if (calls === 1) {
      assert.equal(url, 'https://api.github.com/repos/rodkisten/userscripts-cf/actions/jobs/138873543304/steps/4/logs')
      assert.equal(options.redirect, 'manual')
      assert.equal(options.headers.Authorization, 'Bearer fixture')
      return Response.redirect('https://actionsresults.blob.core.windows.net/log', 302)
    }
    assert.equal(new URL(url).hostname, 'actionsresults.blob.core.windows.net')
    assert.equal(options.headers, undefined)
    assert.equal(options.redirect, 'error')
    return new Response('##[error]Typecheck failed\n' + 'x\n'.repeat(150000))
  })
  const result = await readStepLog('rodkisten', 'userscripts-cf', failure, 'fixture')
  assert.match(result.text, /##\[error\]Typecheck failed/)
  assert.equal(result.truncated, true)
  assert.equal(calls, 2)
})

test('does not follow redirect to an unrecognized host', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.redirect('https://example.org/log', 302))
  assert.equal(await readStepLog('rodkisten', 'userscripts-cf', failure, 'fixture'), null)
  assert.equal(mock.mock.callCount(), 1)
})
