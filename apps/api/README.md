# 🪐 orb API

Elysia on Cloudflare Workers, with a D1 event ledger and Queue-backed dispatch.

## Provisioning

```bash
pnpm install
pnpm --filter @orb/api typecheck
pnpm --filter @orb/api dev
cd apps/api
pnpm exec wrangler secret put ORB_INGEST_TOKEN
```

The D1 database and both queues were provisioned on 2026-11-21, and the real D1 binding ID is committed to `wrangler.jsonc`. Configure the secret and apply migrations:

```bash
pnpm exec wrangler d1 migrations apply orb-events --local
pnpm exec wrangler d1 migrations apply orb-events --remote
```

Only deploy after provisioning and validating the bindings.

## Routes

- `GET /v1/health`: public liveness
- `GET /v1/meta`: public API metadata
- `POST /v1/events/validate`: validate without persistence
- `POST /v1/events`: bearer-token protected, D1-backed idempotent ingestion
- `GET /v1/events/:id`: bearer-token protected processing status
- `GET /v1/openapi`: OpenAPI plugin documentation

## Important limitations

- The Queue consumer currently acknowledges **durable receipt only**; no connector-specific processing is implemented. Its `processed` status does not imply any external side effects.
- D1 insert and Queue send are not atomic. A scheduled sweep runs every five minutes and re-enqueues pending or stale queued records. This provides at-least-once delivery, not exactly-once processing.
- Concurrent retries of pending or stale events may enqueue duplicates. Consumers must remain idempotent. The initial consumer only records durable receipt, not connector-specific completion.
- A shared bearer token is only a bootstrap credential. Per-connector credentials, GitHub HMAC verification, authorization scopes, rate limiting, and retention are future work.
- Never put tokens in URL query parameters or log raw secrets.
- This milestone has not been runtime-verified against Cloudflare. Validate the build, migration, queue and OpenAPI before production deployment.
# Diagnóstico de CI de pull requests

`GET /v1/github/:owner/:repo/pulls/:number/ci` usa a sessão do Cloudflare Access. Configure
`ORB_CI_REPOSITORIES` com os repositórios autorizados, separados por vírgula, e
`ORB_CI_READ_TOKEN` como secret com permissões de leitura de pull requests, Actions e Checks.

A resposta guarda cache no edge por 15 segundos. Quando a execução mais recente do
commit atual termina com falha, o endpoint devolve workflow, job, etapa, primeira
anotação de erro disponível e um link direto para o log no GitHub. Se a execução
mais recente estiver em andamento ou tiver outra conclusão, devolve `{"failure":null}`.

A mesma rota com `?view=page` exibe um diagnóstico HTML protegido pelo
Cloudflare Access. Abra essa URL em uma aba para consultar o resultado quando
o navegador bloquear a sessão em requisições feitas a partir de github.com.

Com `?log=1`, o Orb verifica a execução mais recente novamente e tenta
retornar um trecho do log da etapa que falhou. O trecho tem no máximo 6.000
caracteres e não entra no cache. Quando o GitHub não disponibiliza esse log,
o diagnóstico mantém o link para a execução.
