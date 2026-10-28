"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { Camera, CheckCircle2, ImageUp, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FACE_PHOTO_PREFIX, MAX_FACE_PHOTO_BYTES } from "@/lib/intake/schema";
import { cn } from "@/lib/utils";

/** Longest side of the stored photo, in pixels. */
const MAX_SIDE = 720;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** A face narrower than this share of the photo is too far away to be useful. */
const MIN_FACE_WIDTH = 0.15;

type Problem = "noFace" | "manyFaces" | "tooFar" | "camera" | "file" | "unavailable";

// One detector for the page, loaded on first use (runtime and model are served
// from our own origin: see scripts/copy-vision-wasm.mjs).
let detector: Promise<FaceDetector> | null = null;
function loadDetector(): Promise<FaceDetector> {
  detector ??= import("@mediapipe/tasks-vision")
    .then(({ FaceDetector }) => {
      // The runtime writes its log (e.g. "INFO: Created TensorFlow Lite XNNPACK
      // delegate") to stderr, i.e. console.error; MediaPipe takes these hooks from
      // a pre-set `Module`. Only real errors (glog "E…"/"F…" lines) are kept.
      (self as unknown as { Module?: object }).Module = {
        print: () => undefined,
        printErr: (line: string) => {
          if (/^[EF]\d{4}\b/.test(line)) console.error(line);
        },
      };
      return FaceDetector.createFromOptions(
        { wasmLoaderPath: "/vendor/mediapipe/vision_wasm_internal.js", wasmBinaryPath: "/vendor/mediapipe/vision_wasm_internal.wasm" },
        {
          baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate: "CPU" },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.6,
        },
      );
    })
    .catch((error: unknown) => {
      detector = null;
      throw error;
    });
  return detector;
}

/** JPEG data URL under the size limit (quality lowered if needed). */
function toJpeg(canvas: HTMLCanvasElement): string {
  for (const quality of [0.85, 0.75, 0.6, 0.45]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.startsWith(FACE_PHOTO_PREFIX) && ((url.length - FACE_PHOTO_PREFIX.length) * 3) / 4 <= MAX_FACE_PHOTO_BYTES) return url;
  }
  return "";
}

/**
 * Face photo taken after signing: from the camera (front camera on phones) or
 * an uploaded picture. The photo is accepted only when the face detector finds
 * exactly one face, close enough to the camera; it is reported as a JPEG data
 * URL, or "" while there is none.
 */
export function FaceCapture({
  id,
  value,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  /** Photo accepted earlier (when coming back to the step). */
  value: string;
  invalid?: boolean;
  describedBy?: string;
  onChange: (dataUrl: string) => void;
}) {
  const t = useTranslations("Intake.face");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<"idle" | "camera" | "checking" | "done">(value ? "done" : "idle");
  const [photo, setPhoto] = useState(value);
  const [problem, setProblem] = useState<Problem | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  // Start downloading the detector as soon as the step is shown; release the camera on leave.
  useEffect(() => {
    void loadDetector().catch(() => undefined);
    return stopCamera;
  }, []);

  // The video element exists only in camera mode: attach the stream once it is rendered.
  useEffect(() => {
    const video = videoRef.current;
    if (mode !== "camera" || !video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    void video.play().catch(() => undefined);
  }, [mode]);

  /** Scales the picture down, looks for the face and keeps it if there is exactly one. */
  async function check(source: CanvasImageSource, width: number, height: number) {
    setMode("checking");
    setProblem(null);
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);

    let found: Problem | null;
    try {
      const faces = (await loadDetector()).detect(canvas).detections;
      const widest = Math.max(0, ...faces.map((f) => f.boundingBox?.width ?? 0));
      found = faces.length === 0 ? "noFace" : faces.length > 1 ? "manyFaces" : widest / canvas.width < MIN_FACE_WIDTH ? "tooFar" : null;
    } catch {
      found = "unavailable";
    }
    const url = found ? "" : toJpeg(canvas);
    if (found || !url) {
      setProblem(found ?? "file");
      setMode("idle");
      return;
    }
    setPhoto(url);
    setMode("done");
    onChange(url);
  }

  async function openCamera() {
    setProblem(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      fileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      setMode("camera");
    } catch {
      setProblem("camera");
    }
  }

  function snap() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopCamera();
    void check(canvas, canvas.width, canvas.height);
  }

  async function onFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setProblem(null);
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) return setProblem("file");
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      await check(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
    } catch {
      setProblem("file");
      setMode("idle");
    }
  }

  function retake() {
    setPhoto("");
    setProblem(null);
    setMode("idle");
    onChange("");
  }

  return (
    <div className="space-y-3">
      <div
        id={id}
        role="group"
        aria-labelledby={`${id}-label`}
        aria-describedby={[`${id}-hint`, describedBy].filter(Boolean).join(" ")}
        tabIndex={-1}
        className={cn(
          "relative mx-auto flex aspect-[3/4] w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-mist",
          invalid ? "border-destructive" : "border-azure-100",
        )}
      >
        <span id={`${id}-label`} className="sr-only">
          {t("label")}
        </span>
        {mode === "camera" ? (
          // Mirrored like a mirror; the photo itself is stored unmirrored.
          <video ref={videoRef} playsInline muted className="size-full -scale-x-100 object-cover" />
        ) : null}
        {mode === "done" && photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
          <img src={photo} alt={t("previewAlt")} className="size-full object-cover" />
        ) : null}
        {mode === "checking" ? (
          <p className="flex items-center gap-2 text-sm text-graphite" role="status">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t("checking")}
          </p>
        ) : null}
        {mode === "idle" ? <Camera aria-hidden="true" className="size-12 text-azure-300" /> : null}
        {mode === "camera" ? (
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-[18%] top-[14%] bottom-[22%] rounded-[50%] border-2 border-white/80" />
        ) : null}
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} />
      <div className="flex flex-wrap justify-center gap-2">
        {mode === "idle" ? (
          <>
            <Button type="button" onClick={() => void openCamera()}>
              <Camera aria-hidden="true" />
              {t("openCamera")}
            </Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <ImageUp aria-hidden="true" />
              {t("upload")}
            </Button>
          </>
        ) : null}
        {mode === "camera" ? (
          <>
            <Button type="button" onClick={snap}>
              <Camera aria-hidden="true" />
              {t("take")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                stopCamera();
                setMode("idle");
              }}
            >
              {t("cancel")}
            </Button>
          </>
        ) : null}
        {mode === "done" ? (
          <Button type="button" variant="outline" onClick={retake}>
            <RotateCcw aria-hidden="true" />
            {t("retake")}
          </Button>
        ) : null}
      </div>

      <p
        id={`${id}-hint`}
        className={cn("flex items-start justify-center gap-1.5 text-center text-xs", problem ? "text-destructive" : mode === "done" ? "text-success" : "text-muted-foreground")}
        role={problem ? "alert" : undefined}
      >
        {mode === "done" && !problem ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" /> : null}
        {problem ? t(`problems.${problem}`) : mode === "done" ? t("accepted") : mode === "camera" ? t("cameraHint") : t("hint")}
      </p>
    </div>
  );
}
