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
          <p>The vault stores the collection details and images you choose to add so it can display and value your assets. Card text recognition runs on your device before you review and save the result. Saved collection records and scanned photos are linked to your signed-in account. The signed-in collection lives on the home page after GitHub sign-in; there is no public card grid.</p>
        </section>

        <section>
          <h2>How information is used</h2>
          <p>Collection information is used to operate the vault, show asset details and support valuation features. It is not sold to advertisers. Card values shown for the original UFC set are stored research notes in the app, not a live sold-price feed. Metal melt values use a public spot-price source when it is reachable.</p>
        </section>

        <section>
          <h2>eBay affiliate links</h2>
          <p>Links marked as ads open eBay Australia search results. Affiliate tracking parameters are added only when both an approved eBay campaign ID and marketplace ID are configured; they stay off if those values are missing. After you leave the vault, eBay&apos;s privacy and cookie practices apply.</p>
        </section>

        <section>
          <h2>Valuation evidence</h2>
          <p>Active eBay listings are asking prices. Sold searches and recorded completed sales are kept separate and are never labelled as each other. Catalog UFC figures are stored research notes, not a live sold-price feed. Optional valuation checks you save stay private to your signed-in account and can be included in your private export.</p>
        </section>

        <section>
          <h2>Access, export and deletion</h2>
          <p>Secure account access is provided through GitHub sign-in; the vault does not receive your GitHub password. After you sign in you can download a private copy of your saved records and photos, or permanently delete that data from the vault. Purchase prices are included only in your private export and are never shown on a public page. App-shipped UFC and silver catalog photos remain part of the app and are not removed by account deletion. Collection information is retained while it is needed to provide the service.</p>
        </section>

        <section>
          <h2>Catalog photos</h2>
          <p>Sample UFC and silver photos that ship with the app live under <code>/cards</code> and <code>/metals</code>. Those files are catalog copies, not other users&apos; private scans. The app now requires a signed-in session before serving them, and when a vault owner id is configured they are limited to that owner. Private scans are stored separately and are only readable through an ownership check.</p>
        </section>

        <section>
          <h2>Camera and photos on your device</h2>
          <p>Scanning a card uses the camera or photo library on your phone or computer. Card text recognition runs on your device before you review and save. The vault only stores the front and back images you confirm. Safari on iPhone will ask for Camera or Photos permission the first time you scan. Those photos are linked to your signed-in account and are not used for advertising.</p>
        </section>

        <section>
          <h2>Installable app (PWA)</h2>
          <p>You can add the vault to an iPhone Home Screen from Safari (Share → Add to Home Screen). That is a Progressive Web App, not an App Store listing. A service worker may cache icons and an offline message; it does not cache your private collection APIs or scanned photos.</p>
        </section>

        <Link className="legal-back" href="/">Back to the vault</Link>
      </article>
    </main>
  );
}
