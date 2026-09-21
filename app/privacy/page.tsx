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
        <p className="legal-updated">Last updated 8 September 2026</p>

        <section>
          <h2>Collection information</h2>
          <p>The vault stores the collection details and images you choose to add so it can display and value your assets. Card text recognition runs on your device before you review and save the result. Saved collection records and images are linked to your signed-in account.</p>
        </section>

        <section>
          <h2>How information is used</h2>
          <p>Collection information is used to operate the vault, show asset details and support valuation features. It is not sold to advertisers.</p>
        </section>

        <section>
          <h2>eBay affiliate links</h2>
          <p>Links marked as ads open eBay Australia. Ari&apos;s Collector Vault may earn a commission from qualifying purchases at no extra cost to you. After you leave the vault, eBay&apos;s privacy and cookie practices apply.</p>
        </section>

        <section>
          <h2>Access and storage</h2>
          <p>Secure account access is provided through Sign in with ChatGPT; the vault does not receive your ChatGPT password. Information is retained while it is needed to provide the collection service. Contact the vault owner through the channel that shared this site if you need information corrected or removed.</p>
        </section>

        <Link className="legal-back" href="/">Back to the vault</Link>
      </article>
    </main>
  );
}
