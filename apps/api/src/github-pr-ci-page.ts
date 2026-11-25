import type { PrFailure } from './github-pr-ci'

function html(value: string) {
  return value.replace(/[&<>"']/g, character => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character
  ))
}

export function ciPage(label: string, status: { failure: PrFailure | null } | { error: string }, code = 200) {
  const failure = 'failure' in status ? status.failure : null
  const body = 'error' in status
    ? `<p>${html(status.error)}</p>`
    : failure
      ? `<h2>${html(failure.workflow)}</h2>
         <p>${html([failure.job, failure.step].filter(Boolean).join(' › '))}</p>
         ${failure.error ? `<pre>${html(failure.error)}</pre>` : ''}
         <a href="${html(failure.logUrl)}">Abrir log no GitHub</a>`
      : '<p>A consulta não apontou falha na execução mais recente.</p>'
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CI do pull request · Orb</title>
<style>
  :root{color-scheme:light dark}body{font:1rem/1.5 system-ui;margin:2rem auto;max-width:48rem;padding:0 1rem}
  pre{padding:1rem;border:1px solid GrayText;border-radius:.5rem;white-space:pre-wrap;overflow-wrap:anywhere}
</style>
<main><h1>CI do pull request</h1><p>${html(label)}</p>${body}</main></html>`, {
    status: code,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
