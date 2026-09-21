import Link from "next/link";
import { CreditCard, LockKeyhole, ScanLine, Sparkles } from "lucide-react";

import { CardVault } from "./card-vault";
import { chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import { getVaultIdentity } from "./vault-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getVaultIdentity();

  if (!identity) {
    return (
      <main className="login-page">
        <div className="login-glow login-glow-one" />
        <div className="login-glow login-glow-two" />
        <nav className="login-nav">
          <Link className="login-brand" href="/">
            <span><CreditCard /></span>
            <strong>COLLECTOR VAULT</strong>
          </Link>
          <Link href="/privacy">Privacy</Link>
        </nav>

        <section className="login-shell">
          <div className="login-copy">
            <p className="login-eyebrow"><Sparkles /> YOUR COLLECTION, ONE PLACE</p>
            <h1>A private vault for the things worth collecting.</h1>
            <p className="login-lead">Scan cards, track precious metals and keep rare assets organised in a clean, interactive collection.</p>
            <div className="login-features">
              <div><ScanLine /><span><strong>Smart card scanner</strong>Identify details from front and back photos.</span></div>
              <div><LockKeyhole /><span><strong>Private by default</strong>Your collection and photos stay tied to your account.</span></div>
            </div>
          </div>

          <aside className="login-card">
            <div className="login-card-icon"><CreditCard /></div>
            <p>WELCOME TO</p>
            <h2>Collector Vault</h2>
            <span>Sign in to open your private collection or start a new one.</span>
            <a className="login-button" href={chatGPTSignInPath("/")} target="_top">
              Continue with ChatGPT
            </a>
            <small><LockKeyhole /> Secure sign-in. We never receive your ChatGPT password.</small>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <CardVault
      user={{ displayName: identity.user.displayName, email: identity.user.email }}
      hasLegacyVault={identity.isLegacyOwner}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
