"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  BadgeCheck,
  CircleDollarSign,
  Coins,
  CreditCard,
  Download,
  ExternalLink,
  Gem,
  Heart,
  Layers3,
  LogOut,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Rotate3D,
  RotateCcw,
  ScanLine,
  Search,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Trash2,
  UserRound,
  Vault,
  WalletCards,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { CardScanner, type ScannerAsset } from "./card-scanner";
import { MarketplaceFinder, ValuationEvidencePanel, type ValuationRecord } from "./valuation-panel";
import { parseCardFieldsFromAsset } from "@/lib/card-fields";
import { isSeedAssetKey } from "@/lib/vault-policy";
import {
  catalogNotesAsEvidence,
  historyRowAsEvidence,
  summarizeValuation,
  type CardValuation,
} from "@/lib/valuation-evidence";
import { DELETE_VAULT_CONFIRMATION } from "@/lib/vault-policy";

const TROY_OUNCE_GRAMS = 31.1034768;

type AssetCategory = "card" | "gold" | "silver" | "rare";
type AssetFilter = "all" | "ufc" | AssetCategory;
type CardOrientation = "portrait" | "landscape";
type PriceConfidence = "Strong" | "Moderate" | "Early market";

type UfcCard = {
  key: string;
  category: "card";
  collection: "ufc";
  name: string;
  subtitle: string;
  description: string;
  serial: string;
  valueAud: number;
  rangeAud: string;
  marketUsd: number;
  marketLabel: string;
  marketDate: string;
  marketChecked: string;
  confidence: PriceConfidence;
  confidenceNote: string;
  sourceUrl: string;
  front: string;
  back: string;
  orientation: CardOrientation;
};

const ufcCards: UfcCard[] = [
  {
    key: "carlos-prates-cav-cps-69-99",
    category: "card",
    collection: "ufc",
    name: "Carlos Prates",
    subtitle: "2026 Stadium Club UFC · CAV-CPS",
    description: "Chrome Autograph Variation · Turquoise Refractor",
    serial: "69/99",
    valueAud: 149,
    rangeAud: "A$135–A$165",
    marketUsd: 107,
    marketLabel: "Latest exact sale",
    marketDate: "17 Aug 2026 · ungraded · eBay",
    marketChecked: "5 Sep 2026",
    confidence: "Strong",
    confidenceNote: "One exact-parallel completed sale is indexed.",
    sourceUrl: "https://www.sportscardspro.com/game/ufc-cards-2026-topps-stadium-club-ufc-chrome-autograph/carlos-prates-turquoise-cav-cps",
    front: "/cards/carlos-prates-cav-cps-69-99-front.webp",
    back: "/cards/carlos-prates-cav-cps-69-99-back.webp",
    orientation: "landscape",
  },
  {
    key: "valentina-shevchenko-tvn-35",
    category: "card",
    collection: "ufc",
    name: "Valentina Shevchenko",
    subtitle: "2026 Stadium Club UFC · TVN-35",
    description: "Chrome Triumvirates Nicknames insert",
    serial: "TVN-35",
    valueAud: 28,
    rangeAud: "A$22–A$35",
    marketUsd: 20,
    marketLabel: "Comparable listing level",
    marketDate: "5 Sep 2026 · adjacent TVN panels",
    marketChecked: "5 Sep 2026",
    confidence: "Early market",
    confidenceNote: "A new case-hit insert with limited exact-panel sales.",
    sourceUrl: "https://www.sportscardspro.com/game/ufc-cards-2026-topps-stadium-club-ufc-triumvirates-nickname/valentina-shevchenko-tvn-35",
    front: "/cards/valentina-shevchenko-tvn-35-front.webp",
    back: "/cards/valentina-shevchenko-tvn-35-back.webp",
    orientation: "portrait",
  },
  {
    key: "leon-edwards-86s-le-refractor",
    category: "card",
    collection: "ufc",
    name: "Leon Edwards",
    subtitle: "2026 Topps Chrome UFC · 86S-LE",
    description: "1986 Topps Signatures · Refractor autograph",
    serial: "86S-LE",
    valueAud: 28,
    rangeAud: "A$24–A$32",
    marketUsd: 19.99,
    marketLabel: "Exact-card listing",
    marketDate: "5 Sep 2026 · ungraded · eBay",
    marketChecked: "5 Sep 2026",
    confidence: "Moderate",
    confidenceNote: "Exact card is listed; a fresh completed sale is still needed.",
    sourceUrl: "https://www.sportscardspro.com/game/ufc-cards-2026-topps-chrome-ufc-1986-signature/leon-edwards-refractor-86s-le",
    front: "/cards/leon-edwards-86s-le-refractor-front.webp",
    back: "/cards/leon-edwards-86s-le-refractor-back.webp",
    orientation: "portrait",
  },
  {
    key: "kody-steele-cb-153-16-99",
    category: "card",
    collection: "ufc",
    name: "Kody Steele",
    subtitle: "2026 Stadium Club UFC Chrome · CB-153 RC",
    description: "Turquoise Refractor rookie",
    serial: "16/99",
    valueAud: 21,
    rangeAud: "A$17–A$24",
    marketUsd: 14.99,
    marketLabel: "Exact-parallel listing",
    marketDate: "20 Aug 2026 · ungraded · eBay",
    marketChecked: "5 Sep 2026",
    confidence: "Moderate",
    confidenceNote: "Exact parallel is listed; sales history is still shallow.",
    sourceUrl: "https://www.ebay.com/itm/336746344909",
    front: "/cards/kody-steele-cb-153-16-99-front.webp",
    back: "/cards/kody-steele-cb-153-16-99-back.webp",
    orientation: "landscape",
  },
  {
    key: "carlos-leal-bav-cle-75-99",
    category: "card",
    collection: "ufc",
    name: "Carlos Leal",
    subtitle: "2026 Stadium Club UFC · BAV-CLE RC",
    description: "Base Autograph Variation · Turquoise /99",
    serial: "75/99",
    valueAud: 18,
    rangeAud: "A$14–A$24",
    marketUsd: 13,
    marketLabel: "Comparable estimate",
    marketDate: "5 Sep 2026 · exact card has no indexed sale",
    marketChecked: "5 Sep 2026",
    confidence: "Early market",
    confidenceNote: "Valued from base-autograph and similar /99 listings.",
    sourceUrl: "https://www.sportscardspro.com/game/ufc-cards-2026-topps-stadium-club-ufc-autograph/carlos-leal-turquoise-bav-cle",
    front: "/cards/carlos-leal-bav-cle-75-99-front.webp",
    back: "/cards/carlos-leal-bav-cle-75-99-back.webp",
    orientation: "portrait",
  },
  {
    key: "jonathan-martinez-75-31-99",
    category: "card",
    collection: "ufc",
    name: "Jonathan Martinez",
    subtitle: "2025 Stadium Club UFC · #75 RC",
    description: "Turquoise Foil rookie",
    serial: "31/99",
    valueAud: 14,
    rangeAud: "A$10–A$18",
    marketUsd: 10,
    marketLabel: "Exact-parallel listing",
    marketDate: "5 Sep 2026 · ungraded · eBay",
    marketChecked: "5 Sep 2026",
    confidence: "Moderate",
    confidenceNote: "A matching Turquoise /99 rookie is currently listed.",
    sourceUrl: "https://www.ebay.com/itm/389552355865",
    front: "/cards/jonathan-martinez-75-31-99-front.webp",
    back: "/cards/jonathan-martinez-75-31-99-back.webp",
    orientation: "landscape",
  },
  {
    key: "virna-jandiroba-86s-vj-refractor",
    category: "card",
    collection: "ufc",
    name: "Virna Jandiroba",
    subtitle: "2026 Topps Chrome UFC · 86S-VJ",
    description: "1986 Topps Signatures · Refractor autograph",
    serial: "86S-VJ",
    valueAud: 12,
    rangeAud: "A$10–A$16",
    marketUsd: 8.99,
    marketLabel: "Current ungraded guide",
    marketDate: "5 Sep 2026 · indexed sales",
    marketChecked: "5 Sep 2026",
    confidence: "Moderate",
    confidenceNote: "Exact refractor price guide is supported by recent listings.",
    sourceUrl: "https://www.sportscardspro.com/game/ufc-cards-2026-topps-chrome-ufc-1986-signature/virna-jandiroba-refractor-86s-vj",
    front: "/cards/virna-jandiroba-86s-vj-refractor-front.webp",
    back: "/cards/virna-jandiroba-86s-vj-refractor-back.webp",
    orientation: "portrait",
  },
  {
    key: "nursulton-ruziboev-bav-nr",
    category: "card",
    collection: "ufc",
    name: "Nursulton Ruziboev",
    subtitle: "2026 Topps Chrome UFC · BAV-NR RC",
    description: "Base Card Autograph",
    serial: "BAV-NR",
    valueAud: 10,
    rangeAud: "A$8–A$13",
    marketUsd: 7.43,
    marketLabel: "Current ungraded guide",
    marketDate: "5 Sep 2026 · indexed sales",
    marketChecked: "5 Sep 2026",
    confidence: "Moderate",
    confidenceNote: "Exact base autograph has multiple indexed market points.",
    sourceUrl: "https://www.sportscardspro.com/game/ufc-cards-2026-topps-chrome-ufc-autograph/nursulton-ruziboev-bav-nr",
    front: "/cards/nursulton-ruziboev-bav-nr-front.webp",
    back: "/cards/nursulton-ruziboev-bav-nr-back.webp",
    orientation: "portrait",
  },
  {
    key: "nassourdine-imavov-c-76-78-99",
    category: "card",
    collection: "ufc",
    name: "Nassourdine Imavov",
    subtitle: "2025 Stadium Club UFC Chrome · C-76",
    description: "Orange Refractor",
    serial: "78/99",
    valueAud: 8,
    rangeAud: "A$7–A$12",
    marketUsd: 5.75,
    marketLabel: "Exact-parallel listing",
    marketDate: "5 Sep 2026 · ungraded · eBay",
    marketChecked: "5 Sep 2026",
    confidence: "Moderate",
    confidenceNote: "An exact Orange /99 parallel is currently listed.",
    sourceUrl: "https://www.ebay.com/p/3090138235",
    front: "/cards/nassourdine-imavov-c-76-78-99-front.webp",
    back: "/cards/nassourdine-imavov-c-76-78-99-back.webp",
    orientation: "landscape",
  },
  {
    key: "carlos-leal-71-107-150",
    category: "card",
    collection: "ufc",
    name: "Carlos Leal",
    subtitle: "2026 Topps Chrome UFC · #71 RC",
    description: "Blue Refractor rookie",
    serial: "107/150",
    valueAud: 7,
    rangeAud: "A$6–A$11",
    marketUsd: 5.09,
    marketLabel: "Exact-parallel listing",
    marketDate: "5 Sep 2026 · ungraded · eBay",
    marketChecked: "5 Sep 2026",
    confidence: "Moderate",
    confidenceNote: "Exact Blue /150 rookie parallels are currently listed.",
    sourceUrl: "https://www.ebay.com/itm/117316277085",
    front: "/cards/carlos-leal-71-107-150-front.webp",
    back: "/cards/carlos-leal-71-107-150-back.webp",
    orientation: "portrait",
  },
  {
    key: "ludovit-klein-145-073-150",
    category: "card",
    collection: "ufc",
    name: "Ludovit Klein",
    subtitle: "2026 Topps Chrome UFC · #145",
    description: "Blue Refractor",
    serial: "073/150",
    valueAud: 7,
    rangeAud: "A$6–A$10",
    marketUsd: 4.99,
    marketLabel: "Exact-parallel listing",
    marketDate: "5 Sep 2026 · ungraded · market listing",
    marketChecked: "5 Sep 2026",
    confidence: "Moderate",
    confidenceNote: "A matching Blue /150 is listed in the current market.",
    sourceUrl: "https://www.sportscardspro.com/de/game/ufc-cards-2026-topps-chrome-ufc/ludovit-klein-octafractor-145",
    front: "/cards/ludovit-klein-145-073-150-front.webp",
    back: "/cards/ludovit-klein-145-073-150-back.webp",
    orientation: "landscape",
  },
  {
    key: "gabriel-bonfim-114-366-399",
    category: "card",
    collection: "ufc",
    name: "Gabriel Bonfim",
    subtitle: "2026 Topps Chrome UFC · #114",
    description: "Magenta Refractor",
    serial: "366/399",
    valueAud: 4,
    rangeAud: "A$3–A$7",
    marketUsd: 3,
    marketLabel: "Exact-parallel listing",
    marketDate: "23 Jun 2026 · ungraded · market listing",
    marketChecked: "5 Sep 2026",
    confidence: "Moderate",
    confidenceNote: "A matching Magenta /399 is listed at US$3.",
    sourceUrl: "https://www.whatnot.com/listing/TGlzdGluZ05vZGU6MTk2NzQ4Nzc2NA%3D%3D",
    front: "/cards/gabriel-bonfim-114-366-399-front.webp",
    back: "/cards/gabriel-bonfim-114-366-399-back.webp",
    orientation: "portrait",
  },
];

type StoredAsset = ScannerAsset;

type SpotPrice = {
  symbol: "XAU" | "XAG";
  name: string;
  price: number;
  currency: "AUD";
  updatedAt: string;
};

type CollectionAsset = {
  key: string;
  category: AssetCategory;
  name: string;
  subtitle: string;
  description: string;
  serial: string;
  quantity: number;
  unit: "item" | "g" | "oz";
  purity: number;
  valueAud: number | null;
  imageUrl: string;
  sourceUrl: string;
  collection?: "ufc" | "silver";
  isOwnerPhoto?: boolean;
  front?: string;
  back?: string;
  orientation?: CardOrientation;
  aspectRatio?: number;
  rangeAud?: string;
  marketUsd?: number;
  marketAud?: number;
  meltValueAud?: number | null;
  marketLabel?: string;
  marketDate?: string;
  marketChecked?: string;
  confidence?: PriceConfidence;
  confidenceNote?: string;
  purchasePriceAud?: number | null;
  purchaseDate?: string;
  scanStatus?: string;
  wishlist?: boolean;
  showcase?: boolean;
  storedId?: number;
  manualValueAud?: number | null;
};

type AssetFinancial = {
  assetKey: string;
  purchasePriceAud: number | null;
  purchaseDate: string;
  updatedAt: string;
};

type Rotation = { x: number; y: number };

const currencyWhole = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const currencyPrecise = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatValue(value: number | null) {
  return value === null ? "Waiting…" : currencyWhole.format(value);
}

function formatSignedValue(value: number) {
  const amount = currencyWhole.format(Math.abs(value));
  return `${value >= 0 ? "+" : "−"}${amount}`;
}

function cardValuationFor(asset: CollectionAsset, history: ValuationRecord[]): CardValuation {
  const recorded = history.filter((row) => row.assetKey === asset.key).map(historyRowAsEvidence);
  if (asset.collection === "ufc" || (asset.marketLabel && asset.rangeAud)) {
    return summarizeValuation([...recorded, catalogNotesAsEvidence(asset)]);
  }
  return summarizeValuation(recorded);
}

function assetValue(asset: StoredAsset, spots: Record<string, SpotPrice | null>) {
  if (asset.category === "gold" || asset.category === "silver") {
    const spot = spots[asset.category];
    if (!spot) return null;
    const ounces = asset.unit === "g" ? asset.quantity / TROY_OUNCE_GRAMS : asset.quantity;
    return ounces * asset.purity * spot.price;
  }

  return asset.manualValueAud === null
    ? null
    : asset.manualValueAud * Math.max(1, asset.quantity);
}

function CategoryIcon({ category }: { category: AssetCategory }) {
  if (category === "card") return <CreditCard />;
  if (category === "rare") return <Gem />;
  return <Coins />;
}

function InteractiveCard({ card }: { card: CollectionAsset }) {
  const [rotation, setRotation] = useState<Rotation>({ x: -5, y: -10 });
  const [flipped, setFlipped] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pointer = useRef({ x: 0, y: 0, rx: 0, ry: 0 });

  const style = useMemo(
    () =>
      ({
        "--card-rx": `${rotation.x}deg`,
        "--card-ry": `${rotation.y + (flipped ? 180 : 0)}deg`,
        "--shine-x": `${50 + Math.max(-28, Math.min(28, rotation.y * 1.2))}%`,
        "--shine-y": `${50 - Math.max(-26, Math.min(26, rotation.x * 1.5))}%`,
      }) as CSSProperties,
    [flipped, rotation],
  );
  const stageStyle = {
    "--card-aspect": card.aspectRatio || (card.orientation === "landscape" ? 1.4 : 0.72),
  } as CSSProperties;

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = {
      x: event.clientX,
      y: event.clientY,
      rx: rotation.x,
      ry: rotation.y,
    };
    setDragging(true);
  }

  function moveCard(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    setRotation({
      x: Math.max(-32, Math.min(32, pointer.current.rx - dy * 0.16)),
      y: pointer.current.ry + dx * 0.2,
    });
  }

  function stopDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  function reset() {
    setFlipped(false);
    setRotation({ x: -5, y: -10 });
  }

  return (
    <div className="viewer-stack">
      <div
        className={`card-stage asset-${card.category} is-${card.orientation || "portrait"} ${dragging ? "is-dragging" : ""}`}
        style={stageStyle}
        onPointerDown={startDrag}
        onPointerMove={moveCard}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onDoubleClick={() => setFlipped((value) => !value)}
        role="img"
        aria-label={`Interactive 3D view of ${card.name}. Drag to rotate and flip.`}
      >
        <div className="card-shadow" />
        <div className="card-model" style={style}>
          <div className="card-face card-front">
            <img src={card.front || ""} alt={`${card.name} card front`} draggable={false} />
            <div className="foil-layer" aria-hidden="true" />
            <div className="sleeve-glint" aria-hidden="true" />
          </div>
          <div className="card-face card-back">
            <img src={card.back || ""} alt={`${card.name} card back`} draggable={false} />
            <div className="sleeve-glint back-glint" aria-hidden="true" />
          </div>
          <div className="card-edge edge-top" />
          <div className="card-edge edge-bottom" />
          <div className="card-edge edge-left" />
          <div className="card-edge edge-right" />
        </div>
      </div>

      <div className="viewer-controls" aria-label="3D card controls">
        <Button
          type="button"
          className="vault-button primary-control"
          onClick={() => setFlipped((value) => !value)}
        >
          <Rotate3D />
          {flipped ? "Show front" : card.category === "card" ? "Flip card" : "Flip asset"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="vault-button subtle-control"
          onClick={reset}
        >
          <RotateCcw />
          Reset
        </Button>
      </div>
      <p className="gesture-hint">Drag to tilt · use Flip to see the reverse</p>
    </div>
  );
}

function AssetShowcase({ asset, spot }: { asset: CollectionAsset; spot: SpotPrice | null }) {
  const isMetal = asset.category === "gold" || asset.category === "silver";

  if (isMetal) {
    const perGram = spot ? spot.price / TROY_OUNCE_GRAMS : null;
    return (
      <div className={`material-showcase ${asset.category}`}>
        <div className="material-halo" aria-hidden="true" />
        <div className="material-token">
          <CategoryIcon category={asset.category} />
          <span>{asset.category === "gold" ? "AU" : "AG"}</span>
          <small>{asset.purity * 100}% PURE</small>
        </div>
        <div className="material-readout">
          <span>Live spot per gram</span>
          <strong>{perGram === null ? "Connecting…" : currencyPrecise.format(perGram)}</strong>
          <p>{asset.quantity}{asset.unit} held · {formatValue(asset.valueAud)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="generic-showcase">
      <div className="generic-object">
        {asset.imageUrl ? (
          <img src={asset.imageUrl} alt={asset.name} />
        ) : (
          <div className="generic-placeholder">
            <CategoryIcon category={asset.category} />
            <span>Image research pending</span>
          </div>
        )}
        <div className="object-glint" aria-hidden="true" />
      </div>
      <p>{asset.imageUrl ? "Catalog image · verify against your exact asset" : "Add an owner or verified catalog image"}</p>
    </div>
  );
}

function AddAssetDialog({
  onAdded,
}: {
  onAdded: (asset: StoredAsset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<AssetCategory>("gold");
  const [unit, setUnit] = useState<"item" | "g" | "oz">("g");
  const [saving, setSaving] = useState(false);
  const isMetal = category === "gold" || category === "silver";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          name: form.get("name"),
          description: form.get("description"),
          quantity: Number(form.get("quantity") || 1),
          unit: isMetal ? unit : "item",
          purity: isMetal ? Number(form.get("purity") || 100) / 100 : 1,
          manualValueAud: isMetal ? null : Number(form.get("manualValueAud") || 0),
          imageUrl: form.get("imageUrl"),
          serial: form.get("serial"),
          sourceUrl: form.get("sourceUrl"),
        }),
      });
      const payload = (await response.json()) as { asset?: StoredAsset; error?: string };
      if (!response.ok || !payload.asset) throw new Error(payload.error || "Could not save asset");

      onAdded(payload.asset);
      setOpen(false);
      setCategory("gold");
      setUnit("g");
      formElement.reset();
      toast.success(`${payload.asset.name} added to the vault`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save asset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="add-asset-button"><Plus /> Add asset</Button>
      </DialogTrigger>
      <DialogContent className="asset-dialog">
        <DialogHeader>
          <DialogTitle>Add a tangible asset</DialogTitle>
          <DialogDescription>
            Metals use live spot prices. Cards and rare items use the market value you enter until their sold comps are researched.
          </DialogDescription>
        </DialogHeader>
        <form className="asset-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field full-field">
              <Label htmlFor="asset-category">Asset type</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as AssetCategory)}>
                <SelectTrigger id="asset-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="card">Trading card</SelectItem>
                  <SelectItem value="rare">Rare collectible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="field full-field">
              <Label htmlFor="asset-name">Name</Label>
              <Input id="asset-name" name="name" required maxLength={120} placeholder={isMetal ? "e.g. Perth Mint 1 oz bar" : "e.g. signed UFC glove"} />
            </div>
            <div className="field">
              <Label htmlFor="asset-quantity">{isMetal ? "Weight" : "Quantity"}</Label>
              <Input id="asset-quantity" name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required />
            </div>
            {isMetal ? (
              <>
                <div className="field">
                  <Label htmlFor="asset-unit">Unit</Label>
                  <Select value={unit} onValueChange={(value) => setUnit(value as "g" | "oz")}>
                    <SelectTrigger id="asset-unit"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">Grams</SelectItem>
                      <SelectItem value="oz">Troy ounces</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="field full-field">
                  <Label htmlFor="asset-purity">Purity %</Label>
                  <Input id="asset-purity" name="purity" type="number" min="0.1" max="100" step="0.01" defaultValue="99.99" required />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <Label htmlFor="asset-value">Current value (AUD)</Label>
                  <Input id="asset-value" name="manualValueAud" type="number" min="0" step="0.01" required placeholder="0.00" />
                </div>
                <div className="field full-field">
                  <Label htmlFor="asset-serial">Serial, edition or grade</Label>
                  <Input id="asset-serial" name="serial" maxLength={80} placeholder="e.g. 69/99 or PSA 10" />
                </div>
              </>
            )}
            <div className="field full-field">
              <Label htmlFor="asset-description">Notes</Label>
              <Textarea id="asset-description" name="description" maxLength={500} placeholder="Condition, mint, year or anything important" />
            </div>
            {!isMetal && (
              <>
                <div className="field full-field">
                  <Label htmlFor="asset-image">Verified image URL (optional)</Label>
                  <Input id="asset-image" name="imageUrl" type="url" placeholder="https://…" />
                </div>
                <div className="field full-field">
                  <Label htmlFor="asset-source">Market source URL (optional)</Label>
                  <Input id="asset-source" name="sourceUrl" type="url" placeholder="https://…" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" className="save-asset-button" disabled={saving}>
              {saving ? <RefreshCw className="spin" /> : <Vault />}
              {saving ? "Saving…" : "Save to vault"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseDialog({
  asset,
  onSaved,
}: {
  asset: CollectionAsset;
  onSaved: (financial: AssetFinancial) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawPrice = String(form.get("purchasePriceAud") || "").trim();

    setSaving(true);
    try {
      const response = await fetch("/api/financials", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetKey: asset.key,
          purchasePriceAud: rawPrice ? Number(rawPrice) : null,
          purchaseDate: String(form.get("purchaseDate") || ""),
        }),
      });
      const payload = (await response.json()) as { financial?: AssetFinancial; error?: string };
      if (!response.ok || !payload.financial) throw new Error(payload.error || "Could not save purchase details");

      onSaved(payload.financial);
      setOpen(false);
      toast.success(rawPrice ? "Purchase details saved" : "Purchase price cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save purchase details");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="purchase-button">
          {asset.purchasePriceAud === null || asset.purchasePriceAud === undefined ? <WalletCards /> : <Pencil />}
          {asset.purchasePriceAud === null || asset.purchasePriceAud === undefined ? "Add cost" : "Edit cost"}
        </Button>
      </DialogTrigger>
      <DialogContent className="asset-dialog purchase-dialog">
        <DialogHeader>
          <DialogTitle>Purchase details</DialogTitle>
          <DialogDescription>{asset.name} · used to calculate your personal return.</DialogDescription>
        </DialogHeader>
        <form className="asset-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field full-field">
              <Label htmlFor={`purchase-price-${asset.key}`}>Total paid (AUD)</Label>
              <Input
                id={`purchase-price-${asset.key}`}
                name="purchasePriceAud"
                type="number"
                min="0"
                step="0.01"
                defaultValue={asset.purchasePriceAud ?? ""}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="field full-field">
              <Label htmlFor={`purchase-date-${asset.key}`}>Purchase date (optional)</Label>
              <Input
                id={`purchase-date-${asset.key}`}
                name="purchaseDate"
                type="date"
                defaultValue={asset.purchaseDate || ""}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="save-asset-button" disabled={saving}>
              {saving ? <RefreshCw className="spin" /> : <WalletCards />}
              {saving ? "Saving…" : "Save details"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAssetDialog({
  asset,
  onSaved,
}: {
  asset: CollectionAsset;
  onSaved: (update: { asset: StoredAsset; financial?: AssetFinancial | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wishlist, setWishlist] = useState(Boolean(asset.wishlist));
  const [showcase, setShowcase] = useState(Boolean(asset.showcase));
  const storedId = asset.storedId;
  if (!storedId) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawPrice = String(form.get("purchasePriceAud") || "").trim();
    setSaving(true);
    try {
      const response = await fetch("/api/assets", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: storedId,
          name: String(form.get("name") || "").trim(),
          description: String(form.get("description") || ""),
          serial: String(form.get("serial") || ""),
          sourceUrl: String(form.get("sourceUrl") || ""),
          manualValueAud: String(form.get("manualValueAud") || "").trim()
            ? Number(form.get("manualValueAud"))
            : asset.category === "gold" || asset.category === "silver"
              ? null
              : asset.manualValueAud ?? asset.valueAud,
          wishlist,
          showcase,
          purchasePriceAud: rawPrice ? Number(rawPrice) : null,
          purchaseDate: String(form.get("purchaseDate") || ""),
        }),
      });
      const payload = (await response.json()) as { asset?: StoredAsset; financial?: AssetFinancial; error?: string };
      if (!response.ok || !payload.asset) throw new Error(payload.error || "Could not save changes");
      onSaved({ asset: payload.asset, financial: payload.financial });
      setOpen(false);
      toast.success("Vault item updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) {
        setWishlist(Boolean(asset.wishlist));
        setShowcase(Boolean(asset.showcase));
      }
    }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="purchase-button edit-asset-button">
          <Pencil />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="asset-dialog">
        <DialogHeader>
          <DialogTitle>Edit vault item</DialogTitle>
          <DialogDescription>Notes, purchase details and flags stay private to your account.</DialogDescription>
        </DialogHeader>
        <form className="asset-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field full-field">
              <Label htmlFor={`edit-name-${storedId}`}>Name</Label>
              <Input id={`edit-name-${storedId}`} name="name" required maxLength={120} defaultValue={asset.name} />
            </div>
            <div className="field full-field">
              <Label htmlFor={`edit-notes-${storedId}`}>Notes</Label>
              <Textarea id={`edit-notes-${storedId}`} name="description" maxLength={500} defaultValue={asset.description} placeholder="Condition, set details or anything important" />
            </div>
            {asset.category !== "gold" && asset.category !== "silver" && (
              <>
                <div className="field">
                  <Label htmlFor={`edit-serial-${storedId}`}>Serial, edition or grade</Label>
                  <Input id={`edit-serial-${storedId}`} name="serial" maxLength={80} defaultValue={asset.serial} />
                </div>
                <div className="field">
                  <Label htmlFor={`edit-value-${storedId}`}>Current value (AUD)</Label>
                  <Input id={`edit-value-${storedId}`} name="manualValueAud" type="number" min="0" step="0.01" defaultValue={asset.manualValueAud ?? asset.valueAud ?? ""} />
                </div>
                <div className="field full-field">
                  <Label htmlFor={`edit-source-${storedId}`}>Market source URL (optional)</Label>
                  <Input id={`edit-source-${storedId}`} name="sourceUrl" type="url" defaultValue={asset.sourceUrl} placeholder="https://…" />
                </div>
              </>
            )}
            <div className="field">
              <Label htmlFor={`edit-price-${storedId}`}>Total paid (AUD)</Label>
              <Input id={`edit-price-${storedId}`} name="purchasePriceAud" type="number" min="0" step="0.01" defaultValue={asset.purchasePriceAud ?? ""} placeholder="Private" />
            </div>
            <div className="field">
              <Label htmlFor={`edit-date-${storedId}`}>Purchase date</Label>
              <Input id={`edit-date-${storedId}`} name="purchaseDate" type="date" defaultValue={asset.purchaseDate || ""} />
            </div>
            <label className="flag-check">
              <Checkbox checked={wishlist} onCheckedChange={(value) => setWishlist(value === true)} />
              <span><Heart /> Wishlist</span>
            </label>
            <label className="flag-check">
              <Checkbox checked={showcase} onCheckedChange={(value) => setShowcase(value === true)} />
              <span><Star /> Showcase piece</span>
            </label>
          </div>
          <DialogFooter>
            <Button type="submit" className="save-asset-button" disabled={saving}>
              {saving ? <RefreshCw className="spin" /> : <Pencil />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VaultDataControls({
  onDeleted,
}: {
  onDeleted: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function downloadExport() {
    setExporting(true);
    try {
      const response = await fetch("/api/export", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Could not export the vault");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `card-vault-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Private export downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export the vault");
    } finally {
      setExporting(false);
    }
  }

  async function deleteVault() {
    if (confirmText !== DELETE_VAULT_CONFIRMATION) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: confirmText }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete the vault");
      setDeleteOpen(false);
      setConfirmText("");
      onDeleted();
      toast.success("Saved vault data deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the vault");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className="header-tool vault-data-button" onClick={() => void downloadExport()} disabled={exporting} aria-label="Export collection">
        {exporting ? <RefreshCw className="spin" /> : <Download />}
        <span>{exporting ? "Exporting…" : "Export"}</span>
      </Button>
      <Button type="button" variant="outline" className="header-tool vault-delete-button" onClick={() => setDeleteOpen(true)} aria-label="Delete my vault data">
        <Trash2 />
        <span>Delete</span>
      </Button>
      <AlertDialog open={deleteOpen} onOpenChange={(next) => {
        setDeleteOpen(next);
        if (!next) setConfirmText("");
      }}>
        <AlertDialogContent className="asset-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your vault data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes saved cards, private scans, notes and purchase prices for this signed-in account. App-shipped UFC and silver catalog photos stay in the app. Type <strong>{DELETE_VAULT_CONFIRMATION}</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={DELETE_VAULT_CONFIRMATION}
            autoComplete="off"
            aria-label="Type the delete confirmation phrase"
          />
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void deleteVault()}
              disabled={deleting || confirmText !== DELETE_VAULT_CONFIRMATION}
            >
              {deleting ? "Deleting…" : "Delete my data"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type CardVaultProps = {
  user: { displayName: string; email: string };
  hasLegacyVault: boolean;
  signOutPath: string;
};

const emptyAsset: CollectionAsset = {
  key: "empty-vault",
  category: "card",
  name: "Start your collection",
  subtitle: "Scan a card or add your first tangible asset",
  description: "Your private vault is ready for cards, metals and rare collectibles.",
  serial: "",
  quantity: 1,
  unit: "item",
  purity: 1,
  valueAud: null,
  imageUrl: "",
  sourceUrl: "",
};

export function CardVault({ user, hasLegacyVault, signOutPath }: CardVaultProps) {
  const [storedAssets, setStoredAssets] = useState<StoredAsset[]>([]);
  const [financials, setFinancials] = useState<Record<string, AssetFinancial>>({});
  const [valuations, setValuations] = useState<ValuationRecord[]>([]);
  const [filter, setFilter] = useState<AssetFilter>(hasLegacyVault ? "ufc" : "all");
  const [selectedKey, setSelectedKey] = useState(hasLegacyVault ? ufcCards[0].key : "");
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [priceError, setPriceError] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showcase, setShowcase] = useState(false);
  const [spots, setSpots] = useState<Record<"gold" | "silver", SpotPrice | null>>({
    gold: null,
    silver: null,
  });

  const refreshPrices = useCallback(async () => {
    try {
      const [goldResponse, silverResponse] = await Promise.all([
        fetch("https://api.gold-api.com/price/XAU/AUD", { cache: "no-store" }),
        fetch("https://api.gold-api.com/price/XAG/AUD", { cache: "no-store" }),
      ]);
      if (!goldResponse.ok || !silverResponse.ok) throw new Error("Price feed unavailable");
      const [gold, silver] = await Promise.all([
        goldResponse.json() as Promise<SpotPrice>,
        silverResponse.json() as Promise<SpotPrice>,
      ]);
      if (!Number.isFinite(gold.price) || !Number.isFinite(silver.price)) throw new Error("Invalid price feed");
      setSpots({ gold, silver });
      setPriceError(false);
    } catch {
      setPriceError(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  }

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refreshPrices(), 0);
    const timer = window.setInterval(() => void refreshPrices(), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refreshPrices]);

  useEffect(() => {
    let active = true;
    async function loadCollectionData() {
      try {
        const [assetResponse, financialResponse, valuationResponse] = await Promise.all([
          fetch("/api/assets", { cache: "no-store" }),
          fetch("/api/financials", { cache: "no-store" }),
          fetch("/api/valuations", { cache: "no-store" }),
        ]);
        const assetPayload = (await assetResponse.json()) as { assets?: StoredAsset[] };
        const financialPayload = (await financialResponse.json()) as { financials?: AssetFinancial[] };
        const valuationPayload = (await valuationResponse.json()) as { valuations?: ValuationRecord[] };
        if (active && assetResponse.ok && assetPayload.assets) setStoredAssets(assetPayload.assets);
        if (active && financialResponse.ok && financialPayload.financials) {
          setFinancials(Object.fromEntries(financialPayload.financials.map((item) => [item.assetKey, item])));
        }
        if (active && valuationResponse.ok && valuationPayload.valuations) {
          setValuations(valuationPayload.valuations);
        }
      } catch {
        if (active) toast.error("Some collection details could not be loaded");
      } finally {
        if (active) setLoadingAssets(false);
      }
    }
    void loadCollectionData();
    return () => { active = false; };
  }, []);

  const collection = useMemo<CollectionAsset[]>(() => {
    const builtIn: CollectionAsset[] = hasLegacyVault ? ufcCards.map((card) => ({
      ...card,
      quantity: 1,
      unit: "item",
      purity: 1,
      imageUrl: card.front,
      isOwnerPhoto: true,
      purchasePriceAud: financials[card.key]?.purchasePriceAud ?? null,
      purchaseDate: financials[card.key]?.purchaseDate || "",
    })) : [];
    const silverMeltValue = spots.silver ? spots.silver.price * 0.9999 : null;
    const jamesBondSilver: CollectionAsset = {
      key: "james-bond-60-years-1oz-silver",
      category: "silver",
      collection: "silver",
      name: "James Bond · 60 Years of Bond",
      subtitle: "2022 Perth Mint · Tuvalu $1 · Coin in card",
      description: "1 troy oz of 99.99% silver · carded issue limit 2,500",
      serial: "1 oz · .9999",
      quantity: 1,
      unit: "oz",
      purity: 0.9999,
      valueAud: Math.max(120, silverMeltValue || 0),
      meltValueAud: silverMeltValue,
      imageUrl: "/metals/james-bond-60-years-1oz-front.webp",
      sourceUrl: "https://the-coin-chest.com/product/perth-mint/2022-1-60-years-of-bond-1oz-silver-coin-in-card/",
      isOwnerPhoto: true,
      front: "/metals/james-bond-60-years-1oz-front.webp",
      back: "/metals/james-bond-60-years-1oz-back.webp",
      orientation: "portrait",
      aspectRatio: 1400 / 1650,
      rangeAud: "A$105–A$170",
      marketAud: 105.27,
      marketLabel: "Exact carded retail reference",
      marketDate: "Sold out · Australian dealer",
      marketChecked: "5 Sep 2026",
      confidence: "Early market",
      confidenceNote: "The exact carded issue is sold out at A$105.27; resale data is thin, so the premium estimate stays conservative.",
      purchasePriceAud: financials["james-bond-60-years-1oz-silver"]?.purchasePriceAud ?? null,
      purchaseDate: financials["james-bond-60-years-1oz-silver"]?.purchaseDate || "",
    };

    return [
      ...builtIn,
      ...(hasLegacyVault ? [jamesBondSilver] : []),
      ...storedAssets.map((asset) => ({
        key: `asset-${asset.id}`,
        category: asset.category,
        name: asset.name,
        subtitle:
          asset.category === "gold" || asset.category === "silver"
            ? `${asset.quantity}${asset.unit} · ${(asset.purity * 100).toFixed(2)}% purity`
            : asset.serial || (asset.category === "card" ? "Trading card" : "Rare collectible"),
        description: asset.description,
        serial: asset.serial,
        quantity: asset.quantity,
        unit: asset.unit,
        purity: asset.purity,
        valueAud: assetValue(asset, spots),
        imageUrl: asset.imageUrl,
        sourceUrl: asset.sourceUrl,
        isOwnerPhoto: Boolean(asset.imageUrl && asset.backImageUrl),
        front: asset.imageUrl,
        back: asset.backImageUrl,
        orientation: "portrait" as const,
        scanStatus: asset.scanStatus,
        wishlist: Boolean(asset.wishlist),
        showcase: Boolean(asset.showcase),
        storedId: asset.id,
        manualValueAud: asset.manualValueAud,
        purchasePriceAud: financials[`asset-${asset.id}`]?.purchasePriceAud ?? null,
        purchaseDate: financials[`asset-${asset.id}`]?.purchaseDate || "",
      })),
    ];
  }, [financials, hasLegacyVault, spots, storedAssets]);

  const selected = collection.find((asset) => asset.key === selectedKey) || collection[0] || emptyAsset;
  const filteredAssets = filter === "all"
    ? collection
    : filter === "ufc"
      ? collection.filter((asset) => asset.collection === "ufc")
      : collection.filter((asset) => asset.category === filter);
  const visibleAssets = [...filteredAssets].sort(
    (left, right) => (right.valueAud ?? -1) - (left.valueAud ?? -1),
  );
  const portfolioValue = collection.reduce((sum, asset) => sum + (asset.valueAud || 0), 0);
  const cards = collection.filter((asset) => asset.category === "card").length;
  const metals = collection.filter((asset) => asset.category === "gold" || asset.category === "silver").length;
  const rares = collection.filter((asset) => asset.category === "rare").length;
  const highestValueAsset = [...collection].sort((left, right) => (right.valueAud || 0) - (left.valueAud || 0))[0];
  const selectedSpot = selected.category === "gold" || selected.category === "silver" ? spots[selected.category] : null;
  const latestSpotTime = spots.gold?.updatedAt || spots.silver?.updatedAt;
  const selectedGain = selected.purchasePriceAud !== null && selected.purchasePriceAud !== undefined && selected.valueAud !== null
    ? selected.valueAud - selected.purchasePriceAud
    : null;
  const selectedReturn = selectedGain !== null && selected.purchasePriceAud && selected.purchasePriceAud > 0
    ? (selectedGain / selected.purchasePriceAud) * 100
    : null;
  const selectedConfidenceClass = selected.confidence === "Strong"
    ? "strong"
    : selected.confidence === "Moderate"
      ? "moderate"
      : "early";
  const selectedFields = parseCardFieldsFromAsset(selected);
  const selectedHistory = valuations.filter((row) => row.assetKey === selected.key);
  const selectedValuation = cardValuationFor(selected, valuations);
  const canRecordValuation = !showcase && (Boolean(selected.storedId) || isSeedAssetKey(selected.key));

  function addStoredAsset(asset: StoredAsset) {
    setStoredAssets((current) => [asset, ...current]);
    setSelectedKey(`asset-${asset.id}`);
    setFilter("all");
  }

  function saveFinancial(financial: AssetFinancial) {
    setFinancials((current) => ({ ...current, [financial.assetKey]: financial }));
  }

  function saveEditedAsset({ asset, financial }: { asset: StoredAsset; financial?: AssetFinancial | null }) {
    setStoredAssets((current) => current.map((item) => (item.id === asset.id ? asset : item)));
    if (financial) saveFinancial(financial);
  }

  function removeStoredAsset(id: number) {
    setStoredAssets((current) => current.filter((item) => item.id !== id));
    setFinancials((current) => {
      const next = { ...current };
      delete next[`asset-${id}`];
      return next;
    });
    setValuations((current) => current.filter((row) => row.assetKey !== `asset-${id}`));
    setSelectedKey((current) => (current === `asset-${id}` ? "" : current));
  }

  async function deleteSelectedAsset(asset: CollectionAsset) {
    if (!asset.storedId) return;
    const confirmed = window.confirm(`Remove ${asset.name} from your vault? Private photos and purchase details for this item will be deleted.`);
    if (!confirmed) return;
    try {
      const response = await fetch("/api/assets", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: asset.storedId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete this item");
      removeStoredAsset(asset.storedId);
      toast.success(`${asset.name} removed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this item");
    }
  }

  return (
    <main className={`vault-page ${showcase ? "is-showcase" : ""}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="vault-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><Layers3 /></div>
          <div><p>ARI&apos;S</p><h1>COLLECTOR VAULT</h1></div>
        </div>
        <div className="header-actions">
          <div className="account-chip" title={user.email}>
            <span><UserRound /></span>
            <div><strong>{user.displayName}</strong><small>Private vault</small></div>
            <a href={signOutPath} target="_top" aria-label="Sign out" title="Sign out"><LogOut /></a>
          </div>
          <Button type="button" variant="ghost" className="header-tool theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
            {theme === "light" ? <Moon /> : <Sun />}
          </Button>
          <Button type="button" variant={showcase ? "default" : "outline"} className="header-tool showcase-toggle" onClick={() => setShowcase((current) => !current)}>
            {showcase ? <EyeOff /> : <Eye />}<span>{showcase ? "Exit showcase" : "Showcase"}</span>
          </Button>
          {!showcase && <VaultDataControls onDeleted={() => {
            setStoredAssets([]);
            setFinancials({});
            setValuations([]);
            setSelectedKey(hasLegacyVault ? ufcCards[0].key : "");
          }} />}
          {!showcase && <CardScanner onAdded={addStoredAsset} knownCardNames={collection.filter((asset) => asset.category === "card").map((asset) => asset.name)} />}
          {!showcase && <AddAssetDialog onAdded={addStoredAsset} />}
        </div>
      </header>

      <section className="global-market-search" aria-label="Search cards on eBay Australia">
        <form
          className="global-market-search-form"
          action="/go/ebay"
          method="get"
          target="_blank"
        >
          <div className="global-search-kicker" aria-hidden="true">
            <Search />
            <span>MARKET</span>
          </div>
          <Input
            className="global-search-input"
            type="search"
            name="q"
            placeholder="Search fighter, player, set, year or card number…"
            aria-label="Search eBay Australia for cards"
            autoComplete="off"
            required
          />
          <input type="hidden" name="source" value="global" />
          <select className="global-search-kind" name="kind" aria-label="eBay listing type" defaultValue="active">
            <option value="active">Active listings (asking prices)</option>
            <option value="sold">Sold listings (completed sales)</option>
          </select>
          <Button className="global-search-button" type="submit">
            <span>Search eBay</span>
            <ExternalLink />
          </Button>
        </form>
        <div className="global-search-source" aria-hidden="true">
          <i /> eBay AU · asking and sold stay separate
        </div>
        <p className="global-affiliate-disclosure"><b>Ad</b> · Tracking only if a campaign ID is configured.</p>
      </section>

      {showcase && <div className="showcase-notice"><Eye /> Showcase mode <span>Purchase costs and returns are hidden</span></div>}

      <section className="portfolio-strip" aria-label="Portfolio summary">
        <div className="portfolio-title">
          <span>COLLECTION VALUE</span>
          <div className="portfolio-value">{currencyWhole.format(portfolioValue)}</div>
          <div className="portfolio-mix">
            <span>{cards} cards</span><i />
            <span>{metals} metals</span><i />
            <span>{rares} rare</span>
          </div>
        </div>
        <div className="summary-stats">
          <div className="stat-block"><span>Cards</span><strong>{String(cards).padStart(2, "0")}</strong><small>{hasLegacyVault ? "UFC collection" : "Saved cards"}</small></div>
          <div className="stat-block"><span>Top piece</span><strong>{highestValueAsset ? formatValue(highestValueAsset.valueAud) : "—"}</strong><small>{highestValueAsset?.name || "Collection"}</small></div>
          <div className="stat-block"><span>Assets</span><strong>{String(collection.length).padStart(2, "0")}</strong><small>Highest value first</small></div>
        </div>
      </section>

      <section className="vault-workspace">
        <aside className="collection-panel panel-shell">
          <div className="panel-heading collection-heading">
            <div><p className="eyebrow">YOUR COLLECTION</p><h2>Assets</h2></div>
            <span className="count-chip">{collection.length}</span>
          </div>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as AssetFilter)}>
            <TabsList className="asset-tabs">
              <TabsTrigger value="all">All</TabsTrigger>
              {hasLegacyVault && <TabsTrigger value="ufc">UFC</TabsTrigger>}
              <TabsTrigger value="card">Cards</TabsTrigger>
              <TabsTrigger value="gold">Gold</TabsTrigger>
              <TabsTrigger value="silver">Silver</TabsTrigger>
              <TabsTrigger value="rare">Rare</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="asset-list">
            {loadingAssets && <Skeleton className="asset-row-skeleton" />}
            {visibleAssets.map((asset) => (
              <button
                key={asset.key}
                className={`collection-card category-${asset.category} ${selected.key === asset.key ? "is-selected" : ""}`}
                type="button"
                onClick={() => setSelectedKey(asset.key)}
                aria-current={selected.key === asset.key ? "true" : undefined}
              >
                <div className="collection-thumb">
                  {asset.imageUrl ? <img src={asset.imageUrl} alt="" /> : <CategoryIcon category={asset.category} />}
                  {asset.category === "card" && <span className="mini-shine" />}
                </div>
                <div className="collection-copy">
                  <strong>{asset.name}</strong>
                  <span>{asset.subtitle}</span>
                  <div>
                    <em>{asset.serial || asset.category.toUpperCase()}</em>
                    <b>{formatValue(asset.valueAud)}</b>
                  </div>
                  {(asset.wishlist || asset.showcase) && (
                    <small className="asset-flags">
                      {asset.wishlist ? "Wishlist" : ""}
                      {asset.wishlist && asset.showcase ? " · " : ""}
                      {asset.showcase ? "Showcase" : ""}
                    </small>
                  )}
                </div>
              </button>
            ))}
            {!loadingAssets && visibleAssets.length === 0 && (
              <div className="empty-filter"><Gem /><strong>No assets here yet</strong><span>Add one to start tracking it.</span></div>
            )}
          </div>

          <div className="research-card">
            <SearchCheck />
            <div><strong>Exact owner copies</strong><span>Every photographed asset is matched, enhanced and kept tied to its real markings.</span></div>
          </div>
        </aside>

        <section className="viewer-panel panel-shell">
          <div className="viewer-heading">
            <div>
              <div className="card-kickers">
                <Badge className={`category-badge ${selected.category}`}>{selected.collection === "ufc" ? "UFC" : selected.category.toUpperCase()}</Badge>
                {selected.serial && <Badge variant="outline" className="serial-badge">{selected.serial}</Badge>}
              </div>
              <h2>{selected.name}</h2>
              <p>{selected.subtitle}</p>
            </div>
            <div className="viewer-heading-actions">
              {!showcase && collection.length > 0 && selected.storedId && (
                <EditAssetDialog key={`edit-${selected.key}`} asset={selected} onSaved={saveEditedAsset} />
              )}
              {!showcase && collection.length > 0 && <PurchaseDialog key={selected.key} asset={selected} onSaved={saveFinancial} />}
              {!showcase && selected.storedId && (
                <Button type="button" variant="outline" className="purchase-button delete-asset-button" onClick={() => void deleteSelectedAsset(selected)} aria-label={`Remove ${selected.name}`}>
                  <Trash2 />
                  Remove
                </Button>
              )}
              {collection.length > 0 && <div className="verified-mark" title={selected.isOwnerPhoto ? "Exact owner asset" : "Saved in your collection"}>
                <BadgeCheck />
                {selected.isOwnerPhoto ? "Owner photo" : "In vault"}
              </div>}
            </div>
          </div>
          {collection.length === 0 ? (
            <div className="empty-vault-viewer">
              <div><ScanLine /></div>
              <h3>Your vault is ready</h3>
              <p>Use <strong>Scan card</strong> for front-and-back recognition, or <strong>Add asset</strong> for metals and collectibles.</p>
              <span>Your first saved item will appear here.</span>
            </div>
          ) : selected.isOwnerPhoto && selected.front && selected.back ? <InteractiveCard key={selected.key} card={selected} /> : <AssetShowcase asset={selected} spot={selectedSpot} />}
          {collection.length > 0 && <div className={`viewer-bottom-line ${showcase ? "showcase-values" : ""}`}>
            <div><span>Current value</span><strong>{formatValue(selected.valueAud)}</strong></div>
            {!showcase && <div><span>Purchase cost</span><strong>{selected.purchasePriceAud === null || selected.purchasePriceAud === undefined ? "Not added" : currencyWhole.format(selected.purchasePriceAud)}</strong>{selected.purchaseDate && <small>{new Date(`${selected.purchaseDate}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</small>}</div>}
            {!showcase && <div className={selectedGain === null ? "" : selectedGain < 0 ? "loss-value" : "gain-value"}><span>Your return</span><strong>{selectedGain === null ? "Add cost to track" : `${formatSignedValue(selectedGain)}${selectedReturn === null ? "" : ` · ${selectedReturn >= 0 ? "+" : ""}${selectedReturn.toFixed(1)}%`}`}</strong></div>}
          </div>}
        </section>

        <aside className="intel-panel panel-shell">
          <div className="panel-heading intel-heading">
            <div><p className="eyebrow">MARKET INTELLIGENCE</p><h2>{selected.category === "gold" || selected.category === "silver" ? "Live value" : "Valuation"}</h2></div>
            <CircleDollarSign />
          </div>

          <div className="value-card">
            <span>{collection.length === 0 ? "PRIVATE COLLECTION" : selected.isOwnerPhoto && selected.category === "silver" ? "Estimated collector value" : selected.category === "card" ? "Collection figure" : "Estimated market value"}</span>
            <strong>{collection.length === 0 ? "No assets yet" : formatValue(selected.valueAud)}</strong>
            <p>{collection.length === 0 ? "Only you can see the items saved to this account." : selected.scanStatus === "pending_research" ? selected.description || "Newly scanned card" : selected.rangeAud ? `${selected.description} · stored notes ${selected.rangeAud}` : selected.description || "Saved tangible asset"}</p>
          </div>

          {collection.length === 0 ? (
            <div className="empty-vault-intel"><ShieldCheck /><div><strong>Private by default</strong><span>Scans, photos and collection details are checked against your signed-in account.</span></div></div>
          ) : selected.isOwnerPhoto && selected.category === "silver" ? (
            <>
              <div className="metal-price-grid">
                <div><span>Live melt value</span><strong>{formatValue(selected.meltValueAud ?? null)}</strong></div>
                <div><span>AUD / gram</span><strong>{selectedSpot ? currencyPrecise.format(selectedSpot.price / TROY_OUNCE_GRAMS) : "Connecting…"}</strong></div>
                <div><span>Silver weight</span><strong>1 troy oz</strong></div>
                <div><span>Purity</span><strong>99.99%</strong></div>
              </div>
              <div className="confidence-row">
                <div className="confidence-title"><span>Collector estimate confidence</span><strong>{selected.confidence}</strong></div>
                <div className={`confidence-track ${selectedConfidenceClass}`}><span /></div>
                <p>{selected.confidenceNote} Stored notes / not live sold evidence.</p>
              </div>
              <div className="sale-block">
                <div className="sale-label"><span>{selected.marketLabel}</span><Badge variant="outline" className="note-badge">STORED NOTE / NOT LIVE</Badge></div>
                <div className="sale-price"><strong>{currencyPrecise.format(selected.marketAud || 0)}</strong><span>exact issue</span></div>
                <p>{selected.marketDate}</p>
              </div>
              <a className="market-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">
                Open collector source <ExternalLink />
              </a>
              <div className="market-checked"><RefreshCw /><span>Collector market checked {selected.marketChecked}</span></div>
              <div className="feed-status">
                {priceError ? <WifiOff /> : <Wifi />}
                <div><strong>{priceError ? "Silver feed reconnecting" : "Live silver value active"}</strong><span>{latestSpotTime ? `Source updated ${new Date(latestSpotTime).toLocaleString("en-AU")}` : "Waiting for latest quote"}</span></div>
              </div>
              <div className="source-note"><ShieldCheck /><p>Melt uses the live silver feed. The collector premium above is a stored note, not a sold-comp feed.</p></div>
            </>
          ) : selected.category === "gold" || selected.category === "silver" ? (
            <>
              <div className="metal-price-grid">
                <div><span>AUD / troy oz</span><strong>{selectedSpot ? currencyPrecise.format(selectedSpot.price) : "Connecting…"}</strong></div>
                <div><span>AUD / gram</span><strong>{selectedSpot ? currencyPrecise.format(selectedSpot.price / TROY_OUNCE_GRAMS) : "Connecting…"}</strong></div>
                <div><span>Your weight</span><strong>{selected.quantity}{selected.unit}</strong></div>
                <div><span>Purity</span><strong>{(selected.purity * 100).toFixed(2)}%</strong></div>
              </div>
              <div className="feed-status">
                {priceError ? <WifiOff /> : <Wifi />}
                <div><strong>{priceError ? "Feed reconnecting" : "Live price active"}</strong><span>{latestSpotTime ? `Source updated ${new Date(latestSpotTime).toLocaleString("en-AU")}` : "Waiting for latest quote"}</span></div>
              </div>
              <a className="market-link" href="https://gold-api.com/" target="_blank" rel="noreferrer">Open price source <ExternalLink /></a>
              <div className="source-note"><ShieldCheck /><p>Spot value excludes dealer premiums, fabrication costs, grading and resale fees.</p></div>
            </>
          ) : (
            <>
              {selected.scanStatus === "pending_research" && (
                <div className="scan-ready-card">
                  <ScanLine />
                  <div><strong>Card scan saved</strong><span>Front and back are stored. Search eBay for asking vs sold evidence, then record a check. Asking prices are never treated as sold.</span></div>
                </div>
              )}
              <ValuationEvidencePanel
                valuation={selectedValuation}
                history={selectedHistory}
                assetKey={selected.key}
                canRecord={canRecordValuation}
                onRecorded={(row) => setValuations((current) => [row, ...current.filter((item) => item.id !== row.id)])}
              />
            </>
          )}
          {collection.length > 0 && (
            <MarketplaceFinder name={selected.name} fields={selectedFields} category={selected.category} />
          )}
        </aside>
      </section>

      <footer className="vault-footer">
        <div><Sparkles /> Cards, bullion and rare collectibles in one vault</div>
        <div className="vault-footer-links">
          <p>Collection figures and stored notes are estimates, not guaranteed sale prices. Asking is never sold.</p>
          <Link href="/privacy">Privacy, export &amp; deletion</Link>
        </div>
      </footer>
      <Toaster position="bottom-center" richColors />
    </main>
  );
}
