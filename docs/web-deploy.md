# Web deployment

The React/Vite SPA is deployed independently as orb-web using Wrangler static assets at https://orb.migos.club. The API remains at https://api.orb.migos.club. The web-deploy workflow builds and typechecks the frontend before publishing, then checks the domain. SPA deep links use index.html fallback.

Run `gh workflow run web-deploy.yml -R rodkisten/orb --ref main`.

The production Cloudflare token needs Workers deployment and custom-domain permissions. Existing DNS conflicts must be resolved separately. This initial deployment serves the UI only: relative /v1 API requests require an authenticated same-origin gateway before Events and Connectors work in production. Do not embed Access service tokens in Vite assets or bypass Access. Configure frontend Access protection separately if required.
