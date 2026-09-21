# Cutover checklist (Ari)

Use this after HQ has deployed the Worker. This file does not deploy anything.

## Primary URL

**Use https://card-vault.ariscardvault.workers.dev as the product.**

- Sign in with GitHub (not Google, not ChatGPT).
- Callback already registered: `https://card-vault.ariscardvault.workers.dev/auth/github/callback`
- Install the PWA from that Workers URL in Safari (Share → Add to Home Screen). Do not install from the old ChatGPT Sites hostname.

## When to retire ChatGPT Sites

Keep https://aris-card-vault.aristama27.chatgpt.site/ only as a fallback until all of these are true:

1. GitHub sign-in works on workers.dev (empty private vault for a new account).
2. Scan front/back → confirm draft → save → export works (D1 + R2).
3. Any Sites collection you still care about has been exported (GitHub ids will not match old ChatGPT ids; map `VAULT_LEGACY_OWNER_ID` if the seed UFC/silver catalog should follow Ari).
4. Home Screen icons and shared links point at workers.dev, not `*.chatgpt.site`.
5. You have used Workers as primary for about a week with no need to bounce back.

Then unpublish or delete the ChatGPT Site. After that, Sites SIWC headers are irrelevant; this Worker already ignores them.

Out of scope here: custom domain, TestFlight, Apple Developer.

## What the dedicated bot owns

The GitHub/Cursor bot working this repo owns:

- Source in `arinstamais-lang/Card-vault` (PRs to `main`; does not merge unless you ask)
- Cloudflare Worker name `card-vault`, D1 `card-vault`, R2 bucket `card-vault` **as code and docs** (HQ still runs `wrangler deploy` and `wrangler secret put`)
- GitHub OAuth adapter, session cookie, empty-vault UX, scanner confirmation, export/delete, valuation honesty

The dedicated bot does **not** own:

- ChatGPT Sites dispatch, Sign in with ChatGPT, or OpenAI hosting
- Cloudflare API tokens, GitHub OAuth client secret, or `SESSION_SECRET` (never commit these)
- Apple Developer / TestFlight / App Store listing
- Production deploys unless `wrangler deploy` actually ran with credentials in that session

## HQ deploy reminder

```bash
npm test
npx wrangler deploy
```

PRs from this repo are mergeable product changes. They are not live until HQ deploys.
