"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink, RefreshCw, SearchCheck, ShieldCheck, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ConfirmedCardFields } from "@/lib/card-fields";
import { buildEbaySearchPhrase, ebayVaultPath } from "@/lib/ebay-search";
import {
  conditionKindLabel,
  confidenceLabel,
  evidenceBadge,
  formatMoneyRange,
  matchKindLabel,
  type CardValuation,
  type ConditionKind,
  type ConfidenceLevel,
  type EvidenceKind,
  type MatchKind,
} from "@/lib/valuation-evidence";

export type ValuationRecord = {
  id: number;
  assetKey: string;
  checkedAt: string;
  evidenceKind: EvidenceKind | string;
  matchKind: MatchKind | string;
  conditionKind: ConditionKind | string;
  confidence: ConfidenceLevel | string;
  rangeAudLow: number | null;
  rangeAudHigh: number | null;
  rangeUsdLow: number | null;
  rangeUsdHigh: number | null;
  sourceUrl: string;
  note: string;
  createdAt: string;
};

function badgeClass(kind: EvidenceKind) {
  if (kind === "sold") return "sold-badge";
  if (kind === "asking") return "asking-badge";
  return "note-badge";
}

function kindFromRecord(value: string): EvidenceKind {
  if (value === "sold" || value === "asking") return value;
  return "stored_note";
}

export function MarketplaceFinder({
  name,
  fields,
  category,
}: {
  name: string;
  fields: ConfirmedCardFields;
  category: string;
}) {
  const phrase = useMemo(() => {
    const built = buildEbaySearchPhrase(fields);
    return built || name;
  }, [fields, name]);
  const activeHref = ebayVaultPath({ query: phrase, kind: "active", source: "asset-active" });
  const soldHref = ebayVaultPath({ query: phrase, kind: "sold", source: "asset-sold" });
  const isCard = category === "card";

  return (
    <div className="marketplace-finder">
      <div className="marketplace-heading">
        <span className="marketplace-icon"><ShoppingBag /></span>
        <div>
          <strong>{isCard ? "eBay Australia searches" : "Find one for sale"}</strong>
          <span>
            {isCard
              ? "Active listings are asking prices. Sold listings are completed sales. They are never mixed."
              : "Search live Australian listings for this exact item."}
          </span>
        </div>
      </div>
      {isCard && <p className="search-phrase" title={phrase}>Search phrase: {phrase}</p>}
      <div className="marketplace-actions">
        <a
          className="marketplace-button"
          href={activeHref}
          target="_blank"
          rel="sponsored noreferrer"
          aria-label={`Search active eBay Australia listings (asking prices) for ${name}`}
        >
          Active listings · asking <ExternalLink />
        </a>
        <a
          className="marketplace-button sold-search"
          href={soldHref}
          target="_blank"
          rel="sponsored noreferrer"
          aria-label={`Search sold eBay Australia listings for ${name}`}
        >
          Sold listings · evidence <ExternalLink />
        </a>
      </div>
      <p className="affiliate-disclosure">
        <b>Ad</b> · Opens eBay Australia. Affiliate tracking is added only when campaign IDs are configured; otherwise this is a plain search.
      </p>
    </div>
  );
}

export function ValuationEvidencePanel({
  valuation,
  history,
  assetKey,
  canRecord,
  onRecorded,
}: {
  valuation: CardValuation;
  history: ValuationRecord[];
  assetKey: string;
  canRecord: boolean;
  onRecorded: (row: ValuationRecord) => void;
}) {
  const confidenceClass =
    valuation.confidence === "high" ? "strong" : valuation.confidence === "moderate" ? "moderate" : valuation.confidence === "low" ? "early" : "manual";
  const estimatedBadgeKind = valuation.estimatedFrom === "sold" ? "sold" : valuation.estimatedFrom === "stored_note" ? "stored_note" : "asking";
  const estimatedBadge =
    valuation.estimatedFrom === "sold"
      ? evidenceBadge("sold")
      : valuation.estimatedFrom === "stored_note"
        ? "STORED NOTE / NOT LIVE"
        : "NO LIVE VALUE";

  return (
    <div className="valuation-stack">
      <div className="confidence-row">
        <div className="confidence-title">
          <span>Valuation status</span>
          <strong>{valuation.headline}</strong>
        </div>
        <div className={`confidence-track ${confidenceClass}`}><span /></div>
        <p>{valuation.disclaimer}</p>
      </div>

      <div className="sale-block">
        <div className="sale-label">
          <span>{valuation.estimatedFrom === "sold" ? "Estimated range from sold evidence" : "Estimated range"}</span>
          <Badge variant="outline" className={badgeClass(estimatedBadgeKind === "asking" ? "stored_note" : estimatedBadgeKind)}>
            {estimatedBadge}
          </Badge>
        </div>
        <div className="sale-price">
          <strong>{formatMoneyRange(valuation.estimatedRangeAud, "AUD") || "No range yet"}</strong>
          <span>{formatMoneyRange(valuation.estimatedRangeUsd, "USD") || "USD optional"}</span>
        </div>
        <p>
          {matchKindLabel(valuation.match)} · {conditionKindLabel(valuation.condition)} · Confidence {confidenceLabel(valuation.confidence)}
        </p>
        <p>{valuation.checkedAt ? `Checked ${valuation.checkedAt}` : "No evidence date recorded"}</p>
      </div>

      {valuation.askingRangeAud && (
        <div className="sale-block asking-block">
          <div className="sale-label">
            <span>Active listings (asking prices)</span>
            <Badge variant="outline" className="asking-badge">{evidenceBadge("asking")}</Badge>
          </div>
          <div className="sale-price">
            <strong>{formatMoneyRange(valuation.askingRangeAud, "AUD")}</strong>
            <span>{formatMoneyRange(valuation.askingRangeUsd, "USD") || "Not sold"}</span>
          </div>
          <p>Asking prices are not completed sales and are not used as a live value.</p>
        </div>
      )}

      {valuation.sources.length > 0 && (
        <div className="source-links">
          {valuation.sources.map((source) => (
            <a key={source.url} className="market-link" href={source.url} target="_blank" rel="noreferrer">
              {source.label} · {evidenceBadge(source.kind)} <ExternalLink />
            </a>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="valuation-history">
          <strong>Recorded checks</strong>
          <ul>
            {history.slice(0, 5).map((row) => (
              <li key={row.id}>
                <Badge variant="outline" className={badgeClass(kindFromRecord(String(row.evidenceKind)))}>
                  {evidenceBadge(kindFromRecord(String(row.evidenceKind)))}
                </Badge>
                <span>
                  {row.checkedAt.slice(0, 10)}
                  {row.rangeAudLow != null && row.rangeAudHigh != null
                    ? ` · ${formatMoneyRange({ low: row.rangeAudLow, high: row.rangeAudHigh }, "AUD")}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canRecord && (
        <RecordValuationForm assetKey={assetKey} onRecorded={onRecorded} />
      )}

      <div className="source-note">
        <ShieldCheck />
        <p>No live value is invented. If sold comps are missing, the vault says so instead of treating a listing price as a sale.</p>
      </div>
    </div>
  );
}

function RecordValuationForm({
  assetKey,
  onRecorded,
}: {
  assetKey: string;
  onRecorded: (row: ValuationRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [evidenceKind, setEvidenceKind] = useState<EvidenceKind>("asking");
  const [matchKind, setMatchKind] = useState<MatchKind>("exact");
  const [conditionKind, setConditionKind] = useState<ConditionKind>("raw");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const numberOrNull = (key: string) => {
      const raw = String(form.get(key) || "").trim();
      if (!raw) return null;
      const amount = Number(raw);
      return Number.isFinite(amount) ? amount : null;
    };
    setSaving(true);
    try {
      const response = await fetch("/api/valuations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetKey,
          evidenceKind,
          matchKind,
          conditionKind,
          confidence: evidenceKind === "sold" ? "moderate" : "low",
          rangeAudLow: numberOrNull("rangeAudLow"),
          rangeAudHigh: numberOrNull("rangeAudHigh"),
          rangeUsdLow: numberOrNull("rangeUsdLow"),
          rangeUsdHigh: numberOrNull("rangeUsdHigh"),
          sourceUrl: String(form.get("sourceUrl") || "").trim(),
          note: String(form.get("note") || "").trim(),
          checkedAt: new Date().toISOString(),
        }),
      });
      const payload = (await response.json()) as { valuation?: ValuationRecord; error?: string };
      if (!response.ok || !payload.valuation) throw new Error(payload.error || "Could not save this check");
      onRecorded(payload.valuation);
      setOpen(false);
      event.currentTarget.reset();
      toast.success(evidenceKind === "sold" ? "Sold evidence recorded" : evidenceKind === "asking" ? "Asking-price check recorded" : "Stored note recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this check");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="record-check-button" onClick={() => setOpen(true)}>
        <SearchCheck />
        Record a market check
      </Button>
    );
  }

  return (
    <form className="valuation-form" onSubmit={submit}>
      <p className="valuation-form-title">Record what you found. Do not enter an asking price as sold.</p>
      <div className="form-grid compact-grid">
        <div className="field">
          <Label>Evidence type</Label>
          <Select value={evidenceKind} onValueChange={(value) => setEvidenceKind(value as EvidenceKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="asking">Asking price (active listing)</SelectItem>
              <SelectItem value="sold">Sold evidence (completed sale)</SelectItem>
              <SelectItem value="stored_note">Stored note (not live)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="field">
          <Label>Match</Label>
          <Select value={matchKind} onValueChange={(value) => setMatchKind(value as MatchKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="exact">Exact card</SelectItem>
              <SelectItem value="comparable">Comparable</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="field">
          <Label>Condition</Label>
          <Select value={conditionKind} onValueChange={(value) => setConditionKind(value as ConditionKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="raw">Raw / ungraded</SelectItem>
              <SelectItem value="graded">Graded</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="field">
          <Label htmlFor={`aud-low-${assetKey}`}>AUD low</Label>
          <Input id={`aud-low-${assetKey}`} name="rangeAudLow" type="number" min="0" step="0.01" />
        </div>
        <div className="field">
          <Label htmlFor={`aud-high-${assetKey}`}>AUD high</Label>
          <Input id={`aud-high-${assetKey}`} name="rangeAudHigh" type="number" min="0" step="0.01" />
        </div>
        <div className="field">
          <Label htmlFor={`usd-low-${assetKey}`}>USD low (optional)</Label>
          <Input id={`usd-low-${assetKey}`} name="rangeUsdLow" type="number" min="0" step="0.01" />
        </div>
        <div className="field">
          <Label htmlFor={`usd-high-${assetKey}`}>USD high (optional)</Label>
          <Input id={`usd-high-${assetKey}`} name="rangeUsdHigh" type="number" min="0" step="0.01" />
        </div>
        <div className="field full-field">
          <Label htmlFor={`source-${assetKey}`}>Evidence source URL</Label>
          <Input id={`source-${assetKey}`} name="sourceUrl" type="url" placeholder="https://…" />
        </div>
        <div className="field full-field">
          <Label htmlFor={`note-${assetKey}`}>Note</Label>
          <Textarea id={`note-${assetKey}`} name="note" maxLength={500} placeholder="What did you actually see?" />
        </div>
      </div>
      <div className="valuation-form-actions">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
        <Button type="submit" className="save-asset-button" disabled={saving}>
          {saving ? <RefreshCw className="spin" /> : <SearchCheck />}
          {saving ? "Saving…" : "Save check"}
        </Button>
      </div>
    </form>
  );
}
