# State engine

Query string owns navigation; Zustand mirrors query state, Dexie stores workspace session and drafts. Legacy localStorage is read for migration. Code snapshots use versioned gzip/base64url in hash, bounded to 256 KiB decoded. Codec is infrastructure only: share UI and automatic restoration not yet wired. Never put secrets in share URLs. Format workflow runs after push, commits tracked changes using GitHub Actions token; bot commits do not trigger another workflow. Typecheck before push. Concurrent branch updates may reject push safely.
