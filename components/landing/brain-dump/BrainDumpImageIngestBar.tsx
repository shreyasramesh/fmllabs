"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { compressImageForUpload } from "@/lib/compress-image-for-upload";

/** Vision prompt tuned for meals; quick-estimate still classifies exercise from the resulting text. */
const IMAGE_TRANSCRIBE_MODE = "nutrition" as const;

type Thumb = { id: string; previewUrl: string };

function CameraGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function PhotosGlyph({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06l3.189-3.19a1.5 1.5 0 012.122 0l2.652 2.651 4.023-4.024a1.5 1.5 0 012.121 0L21 15.06V18a.75.75 0 01-.75.75H3.75A.75.75 0 013 18v-1.94zM9 8.25a1.125 1.125 0 1002.25 1.125 1.125 0 000-2.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Small round icon-only control (Quick Note + modal). */
const COMPACT_ICON_BTN =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-background/95 text-neutral-700 shadow-md backdrop-blur-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-neutral-600 dark:bg-neutral-900/95 dark:text-neutral-200 dark:hover:bg-neutral-800";

export function BrainDumpImageIngestBar({
  disabled,
  hintText,
  onAppendText,
  layout = "inline",
}: {
  disabled?: boolean;
  hintText: string;
  onAppendText: (text: string) => void;
  /** `floating`: fixed bottom-right above mobile tab bar. `inline`: slim row in modal sheet. */
  layout?: "inline" | "floating";
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thumbsRef = useRef<Thumb[]>([]);

  useEffect(() => {
    thumbsRef.current = thumbs;
  }, [thumbs]);

  useEffect(() => {
    return () => {
      for (const t of thumbsRef.current) {
        URL.revokeObjectURL(t.previewUrl);
      }
    };
  }, []);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) return;
      setError(null);
      setBusy(true);
      const newThumbs: Thumb[] = list.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        previewUrl: URL.createObjectURL(file),
      }));
      setThumbs((prev) => [...prev, ...newThumbs]);
      try {
        for (let i = 0; i < list.length; i++) {
          const file = list[i]!;
          const thumbId = newThumbs[i]!.id;
          if (file.size > 20 * 1024 * 1024) {
            throw new Error("An image is too large (max 20MB before compression).");
          }
          const { base64, mimeType } = await compressImageForUpload(file);
          const res = await fetch("/api/me/journal/calorie/image-transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType,
              hintText: hintText.slice(0, 600),
              mode: IMAGE_TRANSCRIBE_MODE,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as { error?: string; nutritionLogDraft?: string };
          if (!res.ok) {
            throw new Error(data.error || "Could not read text from this image.");
          }
          const draft = (data.nutritionLogDraft ?? "").trim();
          if (draft) {
            onAppendText(draft);
          }
          setThumbs((prev) => {
            const row = prev.find((t) => t.id === thumbId);
            if (row) URL.revokeObjectURL(row.previewUrl);
            return prev.filter((t) => t.id !== thumbId);
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Image import failed.");
        setThumbs((prev) => {
          for (const t of newThumbs) {
            if (prev.some((p) => p.id === t.id)) URL.revokeObjectURL(t.previewUrl);
          }
          const drop = new Set(newThumbs.map((t) => t.id));
          return prev.filter((t) => !drop.has(t.id));
        });
      } finally {
        setBusy(false);
      }
    },
    [hintText, onAppendText]
  );

  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files;
    e.target.value = "";
    if (f?.length) void processFiles(f);
  };

  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files;
    e.target.value = "";
    if (f?.length) void processFiles(f);
  };

  const thumbSize = layout === "floating" ? "h-10 w-10" : "h-11 w-11";
  const thumbRounded = layout === "floating" ? "rounded-lg" : "rounded-xl";
  const floatingCol = layout === "floating";

  const inner = (
    <div
      className={`flex flex-col gap-1.5 ${floatingCol ? "max-w-[min(100%,18rem)] items-end" : "w-full items-center"}`}
    >
      {error ? (
        <p
          className={`text-red-600 dark:text-red-400 ${floatingCol ? "max-w-[min(100%,18rem)] text-right text-[11px] leading-snug" : "text-center text-[12px]"}`}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {thumbs.length > 0 ? (
        <div
          className={`flex max-h-14 gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] ${floatingCol ? "max-w-[min(100vw-2rem,18rem)] justify-end" : ""}`}
        >
          {thumbs.map((t) => (
            <div
              key={t.id}
              className={`relative ${thumbSize} shrink-0 overflow-hidden ${thumbRounded} border border-neutral-200/80 dark:border-neutral-600`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.previewUrl} alt="" className="h-full w-full object-cover opacity-85" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onCameraChange}
      />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={onGalleryChange} />

      <div className={`flex items-center gap-2.5 ${floatingCol ? "justify-end" : "justify-center"}`}>
        <button
          type="button"
          disabled={disabled || busy}
          className={COMPACT_ICON_BTN}
          onClick={() => cameraRef.current?.click()}
          aria-label="Capture photo"
        >
          <CameraGlyph className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          className={COMPACT_ICON_BTN}
          onClick={() => galleryRef.current?.click()}
          aria-label="Add photos"
        >
          <PhotosGlyph className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  if (layout === "floating") {
    return (
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[34] flex justify-end px-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-1 sm:px-4"
        aria-hidden={false}
      >
        <div className="pointer-events-auto">{inner}</div>
      </div>
    );
  }

  return <div className="flex w-full flex-col items-center gap-1">{inner}</div>;
}
