import Link from "next/link";

export const metadata = {
  title: "Privacy & Affiliates · Ari's Collector Vault",
  description: "How Ari's Collector Vault handles collection data, images and affiliate links.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="legal-kicker">ARI&apos;S COLLECTOR VAULT</p>
        <h1>Privacy &amp; affiliate information</h1>
        <p className="legal-updated">Last updated 21 September 2026</p>

        <section>
          <h2>Collection information</h2>
          <p>The vault stores the collection details and images you choose to add so it can display and value your assets. Card text recognition runs on your device before you review and save the result. Saved collection records and scanned photos are linked to your signed-in account. The signed-in collection lives on the home page after ChatGPT sign-in; there is no public card grid.</p>
        </section>

        <section>
          <h2>How information is used</h2>
          <p>Collection information is used to operate the vault, show asset details and support valuation features. It is not sold to advertisers. Card values shown for the original UFC set are stored research notes in the app, not a live sold-price feed. Metal melt values use a public spot-price source when it is reachable.</p>
        </section>

        <section>
          <h2>eBay affiliate links</h2>
          <p>Links marked as ads open eBay Australia search results. Affiliate tracking parameters are added only when an approved eBay campaign ID is configured; they are currently off. After you leave the vault, eBay&apos;s privacy and cookie practices apply.</p>
        </section>

        <section>
          <h2>Access, export and deletion</h2>
          <p>Secure account access is provided through Sign in with ChatGPT; the vault does not receive your ChatGPT password. There is no in-app export or delete control yet. Information is retained while it is needed to provide the collection service. Contact the vault owner through the channel that shared this site to request a copy of your records or to have them removed.</p>
        </section>

        <Link className="legal-back" href="/">Back to the vault</Link>
      </article>
    </main>
  );
}
