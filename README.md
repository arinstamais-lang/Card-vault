# vinext-starter

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with Cloudflare D1, R2, and Drizzle support.

**Rehost (Cloudflare Workers):** see [`REHOST.md`](./REHOST.md) for `wrangler.toml`, Google sign-in secrets, D1 migrations, and cutover notes. ChatGPT Sites remains live until that cutover; this tree no longer trusts Sites identity headers.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This app uses `wrangler.toml` for Workers + D1 + R2. ChatGPT Sites packaging is opt-in (`SITES_BUILD=1`).

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/auth.ts` provides Google OpenID sign-in helpers (session cookie)
- `app/vault-auth.ts` maps the signed-in user onto per-vault `ownerIds`
- `wrangler.toml` declares D1 (`DB` → `card-vault`) and R2 (`BUCKET` → `card-vault`)
- `vite.config.ts` uses that Wrangler config for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `.openai/hosting.json` remains for an optional Sites rebuild only
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Google Sign-In

Identity is a signed `vault_session` cookie from Google OpenID. Helpers live in `app/auth.ts`:

- `getUser()` / `requireUser(returnTo)` for server-rendered pages
- `<a href={signInPath(returnTo)} target="_top">` to start sign-in (top-level navigation)
- `signOutPath(returnTo)` for the header sign-out link

Do not trust `oai-authenticated-user-*` headers on the Worker. Until `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SECRET` are set, `/auth/google` returns 503 and does not create a session. Setup is in [`REHOST.md`](./REHOST.md).

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Vinext Worker
- `npm run start`: start the built Vinext application
- `npm test`: build and run Node tests
- `npm run db:generate`: generate Drizzle migrations after schema changes
- `npm run cf:deploy`: build and `wrangler deploy` (requires Cloudflare credentials and a real D1 id)

Use build commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
