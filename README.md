# Ari’s Card Vault

Private collector app for trading cards, metals and rare assets. Scan front and back, confirm a draft, keep a signed-in vault, and separate asking prices from sold evidence.

**Live:** https://card-vault.ariscardvault.workers.dev  
**Sign-in:** GitHub OAuth (not Google, not ChatGPT). Callback: `https://card-vault.ariscardvault.workers.dev/auth/github/callback`  
**Host:** Cloudflare Workers + D1 + R2 (`wrangler.toml`). Ops: [`REHOST.md`](./REHOST.md). Cutover: [`CUTOVER.md`](./CUTOVER.md).

This tree does not auto-deploy. HQ runs `wrangler deploy` after merge. Do not put secrets in git.

## Product rules

- Identity is the HMAC `vault_session` cookie from GitHub OAuth. Do not trust `oai-authenticated-user-*` or other spoofable identity headers.
- Scanner results are drafts. Confirm before save. Unread fields stay blank; never invent athlete names or sold prices.
- Asking listings and sold evidence stay labelled separately. eBay affiliate tags stay off unless both campaign and marketplace IDs are set.
- A new GitHub account starts with an empty vault (no sample catalog prices) unless `VAULT_LEGACY_OWNER_ID` matches that account.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout` for `install:ci` / `build` helpers

## Included shape

- Site code under `app/`
- `app/auth.ts` — GitHub sign-in helpers (session cookie)
- `app/vault-auth.ts` — maps the signed-in user onto per-vault `ownerIds`
- `wrangler.toml` — Worker `card-vault`, `workers_dev = true`, D1 `card-vault` (`a85197a6-e0ba-465f-b4f6-b17d8939a5d8`), R2 `card-vault`
- Photos to preserve: `public/cards/` and `public/metals/`
- Optional ChatGPT Sites packaging only when `SITES_BUILD=1` (legacy). Default builds use Workers.

## GitHub sign-in

- `getUser()` / `requireUser(returnTo)` for server-rendered pages
- `<a href={signInPath(returnTo)} target="_top">` to start sign-in
- `signOutPath(returnTo)` for the header sign-out link

Until `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SESSION_SECRET` are set, `/auth/github` returns 503 and does not create a session. Setup is in [`REHOST.md`](./REHOST.md).

## Commands

- `npm run install:ci`: bounded lockfile install
- `npm run dev`: Vite/Vinext development server
- `npm run build`: deployable Vinext Worker
- `npm run start`: start the built app
- `npm test`: build and run Node tests
- `npm run db:migrate:local` / `db:migrate:remote`: drizzle 0000–0005
- `npm run cf:deploy`: build and `wrangler deploy` (Cloudflare credentials required)

## Learn more

- [vinext](https://github.com/cloudflare/vinext)
- [Drizzle D1](https://orm.drizzle.team/docs/get-started/d1-new)
