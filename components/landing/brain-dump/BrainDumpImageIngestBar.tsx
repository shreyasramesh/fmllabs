"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { compressImageForUpload } from "@/lib/compress-image-for-upload";

export type BrainDumpImageTranscribeMode = "nutrition" | "exercise";

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

const BAR_BTN =
  "flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-300/90 bg-neutral-100/80 px-2 text-[10px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-200/90 disabled:cursor-not-allowed disabled:opacity-45 dark:border-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-200 dark:hover:bg-neutral-700/80";

export function BrainDumpImageIngestBar({
  disabled,
  hintText,
  mode,
  onModeChange,
  onAppendText,
}: {
  disabled?: boolean;
  hintText: string;
  mode: BrainDumpImageTranscribeMode;
  onModeChange: (m: BrainDumpImageTranscribeMode) => void;
  onAppendText: (text: string) => void;
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
              mode,
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
    [hintText, mode, onAppendText]
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

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex justify-center gap-1 rounded-xl bg-neutral-100/90 p-0.5 dark:bg-neutral-800/60">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onModeChange("nutrition")}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-colors ${
            mode === "nutrition"
              ? "bg-white text-orange-800 shadow-sm dark:bg-neutral-900 dark:text-orange-200"
              : "text-neutral-500 dark:text-neutral-400"
          }`}
        >
          Food
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onModeChange("exercise")}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-colors ${
            mode === "exercise"
              ? "bg-white text-emerald-800 shadow-sm dark:bg-neutral-900 dark:text-emerald-200"
              : "text-neutral-500 dark:text-neutral-400"
          }`}
        >
          Workout
        </button>
      </div>

      {error ? (
        <p className="text-center text-[12px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {thumbs.length > 0 ? (
        <div className="flex max-h-16 gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {thumbs.map((t) => (
            <div
              key={t.id}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-neutral-200/80 dark:border-neutral-600"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.previewUrl} alt="" className="h-full w-full object-cover opacity-80" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <span
                  className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
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

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          className={BAR_BTN}
          onClick={() => cameraRef.current?.click()}
          aria-label="Capture photo"
        >
          <CameraGlyph className="h-6 w-6" />
          <span>Capture</span>
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          className={BAR_BTN}
          onClick={() => galleryRef.current?.click()}
          aria-label="Upload photos"
        >
          <PhotosGlyph className="h-6 w-6" />
          <span>Photos</span>
        </button>
      </div>
    </div>
  );
}
