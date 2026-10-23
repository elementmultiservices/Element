"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Dancing_Script } from "next/font/google";
import { Eraser, ImageUp, PenLine, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SignatureMethod } from "@/lib/intake/schema";
import { cn } from "@/lib/utils";

const script = Dancing_Script({ subsets: ["latin"], weight: "600", display: "swap" });

const WIDTH = 600;
const HEIGHT = 180;
const INK = "#050D29";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type SignatureLabels = {
  draw: string;
  type: string;
  upload: string;
  clear: string;
  drawHint: string;
  typeLabel: string;
  typeHint: string;
  uploadButton: string;
  uploadHint: string;
  uploadError: string;
};

/**
 * Signature field with three ways to sign: draw it (mouse, touch or pen), type
 * the name in a handwriting font, or upload an image of a signature (a photo
 * of it on paper or a digital signature file). Every method produces the same
 * output: a transparent PNG of fixed size, reported with the method used, or
 * "" once cleared. Uploaded images are trimmed to their ink: the light paper
 * background becomes transparent.
 */
export function SignaturePad({
  id,
  label,
  defaultName,
  labels,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  label: string;
  defaultName: string;
  labels: SignatureLabels;
  invalid?: boolean;
  describedBy?: string;
  onChange: (dataUrl: string, method: SignatureMethod) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [method, setMethod] = useState<SignatureMethod>("draw");
  const [empty, setEmpty] = useState(true);
  const [typed, setTyped] = useState(defaultName);
  const [uploadError, setUploadError] = useState(false);
  const ids = useId();

  const context = () => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
    }
    return ctx;
  };

  const wipe = () => context()?.clearRect(0, 0, WIDTH, HEIGHT);

  const emit = (m: SignatureMethod) => {
    setEmpty(false);
    onChange(canvasRef.current?.toDataURL("image/png") ?? "", m);
  };

  const clear = () => {
    wipe();
    setEmpty(true);
    setUploadError(false);
    if (fileRef.current) fileRef.current.value = "";
    onChange("", method);
  };

  const choose = (m: SignatureMethod) => {
    if (m === method) return;
    setMethod(m);
    wipe();
    setEmpty(true);
    setUploadError(false);
    onChange("", m);
  };

  // Typed signature: re-rendered whenever the name changes.
  useEffect(() => {
    if (method !== "type") return;
    let cancelled = false;
    const name = typed.trim();
    const render = async () => {
      const family = script.style.fontFamily;
      await document.fonts.load(`64px ${family}`).catch(() => undefined);
      const ctx = context();
      if (cancelled || !ctx) return;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      if (!name) {
        setEmpty(true);
        onChange("", "type");
        return;
      }
      let size = 72;
      ctx.font = `600 ${size}px ${family}`;
      while (ctx.measureText(name).width > WIDTH - 40 && size > 24) {
        size -= 4;
        ctx.font = `600 ${size}px ${family}`;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, WIDTH / 2, HEIGHT / 2 + 6);
      emit("type");
    };
    void render();
    return () => {
      cancelled = true;
    };
    // onChange is a fresh closure on every parent render; the name and method drive this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, method]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * WIDTH, y: ((e.clientY - rect.top) / rect.height) * HEIGHT };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (method !== "draw") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = context();
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = context();
    if (!ctx) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    emit("draw");
  };

  async function onFile(file: File | undefined) {
    setUploadError(false);
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > MAX_IMAGE_BYTES) return setUploadError(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const ctx = context();
      if (!ctx) return;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      const scale = Math.min((WIDTH - 20) / img.naturalWidth, (HEIGHT - 20) / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
      // Keep only the ink: light pixels (paper) become transparent, the rest dark blue.
      const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT);
      const d = pixels.data;
      let ink = 0;
      for (let i = 0; i < d.length; i += 4) {
        const alpha = d[i + 3]! / 255;
        const lum = (0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!) * alpha + 255 * (1 - alpha);
        const strength = Math.max(0, Math.min(1, (200 - lum) / 120));
        d[i] = 5;
        d[i + 1] = 13;
        d[i + 2] = 41;
        d[i + 3] = Math.round(strength * 255);
        if (strength > 0.3) ink++;
      }
      ctx.putImageData(pixels, 0, 0);
      if (ink < 30) {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        setEmpty(true);
        onChange("", "upload");
        return setUploadError(true);
      }
      emit("upload");
    } catch {
      setUploadError(true);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const tabs = [
    { key: "draw", icon: PenLine, label: labels.draw },
    { key: "type", icon: Type, label: labels.type },
    { key: "upload", icon: ImageUp, label: labels.upload },
  ] as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium">
          {label}
          <span aria-hidden="true" className="text-destructive"> *</span>
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex gap-1 rounded-full bg-azure-25 p-1">
          {tabs.map(({ key, icon: Icon, label: tabLabel }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={method === key}
              onClick={() => choose(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                method === key ? "bg-white text-ink shadow-sm" : "text-graphite hover:text-ink",
              )}
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {tabLabel}
            </button>
          ))}
        </div>
      </div>

      {method === "type" ? (
        <div className="space-y-1.5">
          <label htmlFor={`${ids}-typed`} className="text-xs text-muted-foreground">
            {labels.typeLabel}
          </label>
          <Input id={`${ids}-typed`} value={typed} maxLength={80} onChange={(e) => setTyped(e.target.value)} className="h-10 bg-background" />
        </div>
      ) : null}

      {method === "upload" ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            id={`${ids}-file`}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <ImageUp aria-hidden="true" />
            {labels.uploadButton}
          </Button>
          <span className="text-xs text-muted-foreground">{labels.uploadHint}</span>
        </div>
      ) : null}

      <div className="relative">
        <canvas
          ref={canvasRef}
          id={id}
          width={WIDTH}
          height={HEIGHT}
          role="img"
          aria-labelledby={`${id}-label`}
          aria-describedby={[`${id}-hint`, describedBy].filter(Boolean).join(" ")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          className={cn(
            "aspect-[10/3] w-full rounded-2xl border-2 border-dashed bg-white",
            method === "draw" ? "cursor-crosshair touch-none" : "pointer-events-none",
            invalid ? "border-destructive" : "border-azure-100",
          )}
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-6 bottom-8 left-6 border-b border-azure-100" />
        {!empty ? (
          <Button type="button" variant="ghost" size="sm" onClick={clear} className="absolute top-2 right-2">
            <Eraser aria-hidden="true" />
            {labels.clear}
          </Button>
        ) : null}
      </div>
      <p id={`${id}-hint`} className={cn("text-xs", uploadError ? "text-destructive" : "text-muted-foreground")}>
        {uploadError ? labels.uploadError : method === "draw" ? labels.drawHint : method === "type" ? labels.typeHint : labels.uploadHint}
      </p>
    </div>
  );
}
