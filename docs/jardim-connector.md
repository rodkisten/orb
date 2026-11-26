# Jardim connector v1

Opt-in: JARDIM_CAPTURE_ENABLED=true and secret JARDIM_CAPTURE_TOKEN. Provision a capture device in Jardim; do not reuse the diary password. Deploy Jardim migration and endpoint first. Only explicit jardim.capture events are delivered; no automatic forwarding of existing GitHub events. Stable UUID derived from durable orb event ID. Queue acknowledgement follows verified receipt. Delivery failure retries via existing queue/outbox. Permanent failures and dead-letter policy need further work. Payload fields: kind (link/github/photo/music/video), title, optional HTTPS url. Jardim strips query and fragment and holds events pending approval.

## Delivery ledger

Apply migration 0002 before deploying. Eight attempts maximum, exponential delay capped at one hour, terminal 400/409/413/422. Access-authenticated listing and same-origin replay endpoint. Replay retains the stable event ID. Disabled connector does not acknowledge capture as delivered. UI and integration tests pending.

## Operations UI

Open /connectors for the latest 100 deliveries, state filters, event inspection and confirmed replay. Counts reflect only the loaded window. Disabled connectors retain queued events without consuming delivery attempts. Error messages are sanitized.
