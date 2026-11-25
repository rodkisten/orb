# Web deployment

The React/Vite SPA is deployed independently as orb-web using Wrangler static assets at https://orb.migos.club. The API remains at https://api.orb.migos.club. The web-deploy workflow builds and typechecks the frontend before publishing, then checks the domain. SPA deep links use index.html fallback.

Run `gh workflow run web-deploy.yml -R rodkisten/orb --ref main`.

The production Cloudflare token needs Workers deployment and custom-domain permissions. Existing DNS conflicts must be resolved separately. This initial deployment serves the UI only: relative /v1 API requests require an authenticated same-origin gateway before Events and Connectors work in production. Do not embed Access service tokens in Vite assets or bypass Access. Configure frontend Access protection separately if required.

Run Wrangler from the workspace root using `pnpm --fail-if-no-match --filter @orb/api exec wrangler deploy --config ../web/wrangler.jsonc`. The API workspace supplies the CLI; the selected config deploys only orb-web. The smoke check verifies the actual SPA root element rather than accepting any HTTP response.

## Same-origin API gateway

The frontend Worker forwards /v1 requests through the orb-api service binding. No service credentials are injected. The backend still validates the Access JWT against its configured audience. Configure the existing Access application to cover both orb.migos.club and api.orb.migos.club with the same audience before using authenticated UI features. Keep existing API service-token policies intact. The gateway rejects cross-origin mutations and webhook forwarding. Until Access is configured, protected endpoints fail closed. The frontend deployment typechecks the gateway separately.
