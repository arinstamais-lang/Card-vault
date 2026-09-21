"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, RefreshCw, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { detectCardDetails, type CardDetection } from "@/lib/card-detection";

export type ScannerAsset = {
  id: number;
  category: "card" | "gold" | "silver" | "rare";
  name: string;
  description: string;
  quantity: number;
  unit: "item" | "g" | "oz";
  purity: number;
  manualValueAud: number | null;
  imageUrl: string;
  backImageUrl: string;
  serial: string;
  sourceUrl: string;
  scanStatus: string;
  createdAt: string;
  wishlist?: boolean;
  showcase?: boolean;
};

type Side = "front" | "back";
type Step = Side | "analysis" | "details";

type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
};

const EMPTY_DETECTION: CardDetection = {
  name: "",
  sport: "",
  year: "",
  setName: "",
  cardNumber: "",
  parallel: "",
  serial: "",
  confidence: 0,
};

function loadPhoto(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The photo could not be opened"));
    };
    image.src = url;
  });
}

function ocrCanvas(image: HTMLImageElement, rotation: 0 | 90 | -90) {
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(2, 2200 / largestSide);
  const imageWidth = Math.round(image.naturalWidth * scale);
  const imageHeight = Math.round(image.naturalHeight * scale);
  const sideways = rotation !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = sideways ? imageHeight : imageWidth;
  canvas.height = sideways ? imageWidth : imageHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The photo could not be prepared");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.filter = "grayscale(1) contrast(1.18)";
  context.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
  return canvas;
}

function detailBands(source: HTMLCanvasElement) {
  const topHeight = Math.round(source.height * 0.4);
  const bottomHeight = Math.round(source.height * 0.48);
  const targetWidth = Math.min(2200, Math.round(source.width * 1.4));
  const topTargetHeight = Math.round(topHeight * (targetWidth / source.width));
  const bottomTargetHeight = Math.round(bottomHeight * (targetWidth / source.width));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = topTargetHeight + bottomTargetHeight + 30;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The card details could not be prepared");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = "grayscale(1) contrast(1.35)";
  context.drawImage(source, 0, 0, source.width, topHeight, 0, 0, targetWidth, topTargetHeight);
  context.drawImage(source, 0, source.height - bottomHeight, source.width, bottomHeight, 0, topTargetHeight + 30, targetWidth, bottomTargetHeight);
  return canvas;
}

function textQuality(text: string) {
  const words = text.match(/[A-Za-z]{2,}/g) || [];
  return words.reduce((score, word) => score + Math.min(word.length, 10), 0);
}

async function recogniseBestOrientation(
  worker: OcrWorker,
  file: File,
  side: Side,
  onAttempt: (label: string) => void,
) {
  const image = await loadPhoto(file);
  const rotations: Array<0 | 90 | -90> = [0, 90, -90];
  let best = "";
  let bestScore = -1;
  let bestRotation: 0 | 90 | -90 = 0;
  let originalScore = -1;

  for (let index = 0; index < rotations.length; index += 1) {
    onAttempt(index === 0 ? `Reading the ${side}…` : `Checking the ${side} orientation…`);
    const canvas = ocrCanvas(image, rotations[index]);
    const result = await worker.recognize(canvas);
    canvas.width = 1;
    canvas.height = 1;
    const score = textQuality(result.data.text);
    if (index === 0) originalScore = score;
    if (score > bestScore) {
      best = result.data.text;
      bestScore = score;
      bestRotation = rotations[index];
    }
    if (index === 0 && score >= 55) break;
    if (index > 0 && originalScore >= 55) break;
  }

  onAttempt(`Reading the ${side} details…`);
  const selectedCanvas = ocrCanvas(image, bestRotation);
  const bands = detailBands(selectedCanvas);
  const detailResult = await worker.recognize(bands);
  selectedCanvas.width = 1;
  selectedCanvas.height = 1;
  bands.width = 1;
  bands.height = 1;

  return `${best}\n${detailResult.data.text}`;
}

function CaptureStep({
  side,
  file,
  preview,
  onChoose,
}: {
  side: Side;
  file: File | null;
  preview: string;
  onChoose: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="scanner-stage">
      <div className="scanner-guide">
        {preview ? (
          <img src={preview} alt={`${side} preview`} />
        ) : (
          <div className="scanner-empty">
            <ScanLine />
            <strong>Photograph the {side}</strong>
            <span>Fill the frame · avoid glare · keep every edge visible</span>
          </div>
        )}
      </div>
      <label className="scanner-camera-button">
        <Camera />
        {file ? `Retake ${side}` : `Take ${side} photo`}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={onChoose} />
      </label>
      <div className="scanner-privacy"><ShieldCheck /> Your photos stay inside your private vault.</div>
    </div>
  );
}

export function CardScanner({ onAdded, knownCardNames = [] }: { onAdded: (asset: ScannerAsset) => void; knownCardNames?: string[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("front");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState("");
  const [backPreview, setBackPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [detection, setDetection] = useState<CardDetection>(EMPTY_DETECTION);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisLabel, setAnalysisLabel] = useState("Preparing card reader…");
  const [analysisError, setAnalysisError] = useState("");

  function reset() {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
    setStep("front");
    setFront(null);
    setBack(null);
    setFrontPreview("");
    setBackPreview("");
    setSaving(false);
    setDetection(EMPTY_DETECTION);
    setAnalysisProgress(0);
    setAnalysisLabel("Preparing card reader…");
    setAnalysisError("");
  }

  async function analyseCard() {
    if (!front || !back) return;
    setStep("analysis");
    setAnalysisProgress(4);
    setAnalysisLabel("Preparing card reader…");
    setAnalysisError("");

    try {
      const { createWorker, PSM } = await import("tesseract.js");
      let phase: Side = "front";
      const worker = await createWorker("eng", 1, {
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract",
        langPath: "/tesseract/lang",
        logger: ({ status, progress }) => {
          if (status === "recognizing text") {
            const base = phase === "front" ? 12 : 55;
            const nextProgress = Math.round(base + progress * 38);
            setAnalysisProgress((current) => Math.max(current, nextProgress));
          }
        },
      });

      try {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          preserve_interword_spaces: "1",
          user_defined_dpi: "300",
        });
        phase = "front";
        const frontText = await recogniseBestOrientation(worker, front, "front", setAnalysisLabel);
        phase = "back";
        const backText = await recogniseBestOrientation(worker, back, "back", setAnalysisLabel);
        setAnalysisLabel("Organising card details…");
        setAnalysisProgress(97);
        const result = detectCardDetails(frontText, backText, knownCardNames);
        setDetection(result);
        setAnalysisProgress(100);
        setStep("details");
        if (!result.name) {
          setAnalysisError("The card name was not clear enough. Add it below and check the other details.");
        }
      } finally {
        await worker.terminate();
      }
    } catch {
      setDetection(EMPTY_DETECTION);
      setAnalysisError("Automatic detection could not read these photos. You can still enter the details below.");
      setStep("details");
    }
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function choose(side: Side) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        toast.error("That photo is over 8 MB. Try taking it again a little closer.");
        event.target.value = "";
        return;
      }
      const preview = URL.createObjectURL(file);
      if (side === "front") {
        if (frontPreview) URL.revokeObjectURL(frontPreview);
        setFront(file);
        setFrontPreview(preview);
      } else {
        if (backPreview) URL.revokeObjectURL(backPreview);
        setBack(file);
        setBackPreview(preview);
      }
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!front || !back) return;
    const values = new FormData(event.currentTarget);
    values.set("front", front);
    values.set("back", back);

    setSaving(true);
    try {
      const response = await fetch("/api/scan-card", { method: "POST", body: values });
      const payload = (await response.json()) as { asset?: ScannerAsset; error?: string };
      if (!response.ok || !payload.asset) throw new Error(payload.error || "Could not save card");
      onAdded(payload.asset);
      toast.success(`${payload.asset.name} scanned into the vault`);
      changeOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save card");
    } finally {
      setSaving(false);
    }
  }

  const stepNumber = step === "front" ? 1 : step === "back" ? 2 : 3;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button className="scan-card-button"><ScanLine /> Scan card</Button>
      </DialogTrigger>
      <DialogContent className="asset-dialog scanner-dialog">
        <DialogHeader>
          <div className="scanner-progress" aria-label={`Step ${stepNumber} of 3`}>
            {[1, 2, 3].map((number) => <span key={number} className={number <= stepNumber ? "is-active" : ""}>{number < stepNumber ? <Check /> : number}</span>)}
          </div>
          <DialogTitle>{step === "front" ? "Scan the front" : step === "back" ? "Scan the back" : step === "analysis" ? "Identifying the card" : "Check the details"}</DialogTitle>
          <DialogDescription>
            {step === "analysis" ? "Reading both sides for names, sets, card numbers and parallels." : step === "details" ? "We filled what we could find. Check it before adding the card." : "Use a plain background and soft light for the cleanest 3D card."}
          </DialogDescription>
        </DialogHeader>

        {step === "front" && <CaptureStep side="front" file={front} preview={frontPreview} onChoose={choose("front")} />}
        {step === "back" && <CaptureStep side="back" file={back} preview={backPreview} onChoose={choose("back")} />}

        {step === "analysis" && (
          <div className="scanner-analysis" aria-live="polite">
            <div className="scanner-analysis-icon"><ScanLine /><span /></div>
            <strong>{analysisLabel}</strong>
            <span>The first scan can take a little longer while the card reader loads.</span>
            <Progress className="scanner-analysis-progress" value={analysisProgress} />
            <small>{analysisProgress}%</small>
          </div>
        )}

        {step === "details" && (
          <form className="asset-form scanner-form" onSubmit={submit}>
            <div className="scan-review-images">
              <div><img src={frontPreview} alt="Card front" /><span>Front</span></div>
              <div><img src={backPreview} alt="Card back" /><span>Back</span></div>
            </div>
            <div className={`scanner-detected ${analysisError ? "is-warning" : ""}`}>
              <Sparkles />
              <div>
                <strong>{analysisError ? "Check the card details" : "Card details detected"}</strong>
                <span>{analysisError || "Front and back matched. Correct anything that does not look right."}</span>
              </div>
              {!analysisError && <b>{detection.confidence}% match</b>}
            </div>
            <div className="form-grid">
              <div className="field full-field">
                <Label htmlFor="scan-name">Fighter or card name</Label>
                <Input id="scan-name" name="name" required maxLength={120} placeholder="e.g. Carlos Prates" defaultValue={detection.name} autoFocus />
              </div>
              <div className="field">
                <Label htmlFor="scan-sport">Sport or card type</Label>
                <Input id="scan-sport" name="sport" maxLength={80} placeholder="e.g. UFC / MMA" defaultValue={detection.sport} />
              </div>
              <div className="field">
                <Label htmlFor="scan-year">Year</Label>
                <Input id="scan-year" name="year" inputMode="numeric" maxLength={4} placeholder="e.g. 2026" defaultValue={detection.year} />
              </div>
              <div className="field full-field">
                <Label htmlFor="scan-set">Set or product</Label>
                <Input id="scan-set" name="setName" maxLength={160} placeholder="e.g. Topps Stadium Club Chrome UFC" defaultValue={detection.setName} />
              </div>
              <div className="field">
                <Label htmlFor="scan-card-number">Card number</Label>
                <Input id="scan-card-number" name="cardNumber" maxLength={80} placeholder="e.g. CAV-CPS" defaultValue={detection.cardNumber} />
              </div>
              <div className="field">
                <Label htmlFor="scan-serial">Serial or grade</Label>
                <Input id="scan-serial" name="serial" maxLength={80} placeholder="e.g. 69/99" defaultValue={detection.serial} />
              </div>
              <div className="field full-field">
                <Label htmlFor="scan-parallel">Parallel or variant</Label>
                <Input id="scan-parallel" name="parallel" maxLength={160} placeholder="e.g. Turquoise Refractor · Autograph" defaultValue={detection.parallel} />
              </div>
              <div className="field full-field">
                <Label htmlFor="scan-description">Extra notes</Label>
                <Textarea id="scan-description" name="description" maxLength={500} placeholder="Condition, grading notes or anything else" />
              </div>
              <div className="field full-field">
                <Label htmlFor="scan-value">Value AUD (optional)</Label>
                <Input id="scan-value" name="manualValueAud" type="number" min="0" step="0.01" placeholder="Research later" />
              </div>
            </div>
            <input type="hidden" name="autoDetected" value={detection.name ? "true" : "false"} />
            <DialogFooter className="scanner-footer">
              <Button type="button" variant="ghost" onClick={() => setStep("back")}><ArrowLeft /> Back</Button>
              <Button type="button" variant="ghost" onClick={() => void analyseCard()}><ScanLine /> Scan again</Button>
              <Button type="submit" className="save-asset-button" disabled={saving}>
                {saving ? <RefreshCw className="spin" /> : <Check />}
                {saving ? "Saving photos…" : "Add to vault"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {(step === "front" || step === "back") && (
          <DialogFooter className="scanner-footer">
            {step === "back" && <Button type="button" variant="ghost" onClick={() => setStep("front")}><ArrowLeft /> Back</Button>}
            <Button
              type="button"
              className="save-asset-button"
              disabled={step === "front" ? !front : !back}
              onClick={() => step === "front" ? setStep("back") : void analyseCard()}
            >
              {step === "front" ? "Continue" : "Identify card"} <ArrowRight />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
