# 🧭 URL-first routing contract

All shareable web state belongs in the URL. The web app uses TanStack Router file-based routing and validates search params.

| Page              | Example URL                                             | State                         |
| ----------------- | ------------------------------------------------------- | ----------------------------- |
| Event explorer    | `/events?source=github&status=failed&limit=25&offset=0` | source, status, limit, offset |
| Event detail      | `/events/evt_123`                                       | event ID                      |
| Run inspector     | `/runs/run_123?tab=logs`                                | run ID, tab                   |
| Component catalog | `/design?category=inputs`                               | category                      |

Use `validateSearch` and typed navigation APIs. Preserve unrelated search params when updating filters. TanStack Query keys must include normalized URL filters. Never put tokens, authorization headers, secrets, private payloads, or OAuth codes into permanent navigation URLs.

The web implementation is pending. The API now exposes `GET /v1/events` with typed `source`, `type`, `status`, `limit`, and `offset` parameters.
