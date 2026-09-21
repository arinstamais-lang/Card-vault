import Link from "next/link";
import { CreditCard, LockKeyhole, ScanLine, Sparkles } from "lucide-react";

import { signInPath, signOutPath } from "./auth";
import { CardVault } from "./card-vault";
import { getVaultIdentity } from "./vault-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getVaultIdentity();

  if (!identity) {
    return (
      <main className="login-page" id="main-content">
        <a className="skip-link" href="#sign-in">Skip to sign in</a>
        <div className="login-glow login-glow-one" aria-hidden="true" />
        <div className="login-glow login-glow-two" aria-hidden="true" />
        <nav className="login-nav" aria-label="Site">
          <Link className="login-brand" href="/">
            <span aria-hidden="true"><CreditCard /></span>
            <strong>COLLECTOR VAULT</strong>
          </Link>
          <Link href="/privacy">Privacy</Link>
        </nav>

        <section className="login-shell">
          <div className="login-copy">
            <p className="login-eyebrow"><Sparkles aria-hidden="true" /> YOUR COLLECTION, ONE PLACE</p>
            <h1>A private vault for the things worth collecting.</h1>
            <p className="login-lead">Scan cards, track precious metals and keep rare assets organised in a clean, interactive collection.</p>
            <div className="login-features">
              <div><ScanLine aria-hidden="true" /><span><strong>Smart card scanner</strong>Identify details from front and back photos.</span></div>
              <div><LockKeyhole aria-hidden="true" /><span><strong>Private by default</strong>Your collection and photos stay tied to your account.</span></div>
            </div>
            <details className="install-iphone">
              <summary>Install on iPhone</summary>
              <ol>
                <li>Open <strong>https://card-vault.ariscardvault.workers.dev</strong> in <strong>Safari</strong> (not an in-app browser such as Instagram or Gmail).</li>
                <li>Tap the <strong>Share</strong> button (square with an arrow).</li>
                <li>Scroll and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
                <li>Ari&apos;s Vault opens full-screen like an app. Camera scanning works from that Home Screen icon.</li>
              </ol>
              <p>Android Chrome may also offer <strong>Install app</strong> after the service worker loads. This is a Progressive Web App on Cloudflare Workers, not a ChatGPT Site or App Store listing.</p>
            </details>
          </div>

          <aside className="login-card" id="sign-in">
            <div className="login-card-icon" aria-hidden="true"><CreditCard /></div>
            <p>WELCOME TO</p>
            <h2>Collector Vault</h2>
            <span>Sign in to open your private collection or start a new one.</span>
            <a className="login-button" href={signInPath("/")} target="_top">
              Sign in with GitHub
            </a>
            <small><LockKeyhole aria-hidden="true" /> Secure sign-in. We never receive your GitHub password.</small>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <CardVault
      user={{ displayName: identity.user.displayName, email: identity.user.email }}
      hasLegacyVault={identity.isLegacyOwner}
      signOutPath={signOutPath("/")}
    />
  );
}
