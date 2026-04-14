"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  LANDING_DASHBOARD_SECTIONS,
  scrollToLandingDashboardSection,
} from "@/lib/landing-dashboard-sections";
import { SparklesIcon } from "@/components/SharedIcons";
import { transcribeJournalImageFile } from "@/lib/journal-image-transcribe-client";
import { dispatchJournalImageAnalysesBridge } from "@/lib/journal-image-analyses-bridge";

const SATELLITE_BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-background/95 text-neutral-700 shadow-lg backdrop-blur-sm transition-transform hover:scale-105 hover:bg-neutral-50 active:scale-95 dark:border-neutral-600 dark:bg-neutral-900/95 dark:text-neutral-200 dark:hover:bg-neutral-800";

/** `display:none` breaks some browsers’ file picker when triggered from a portaled control. */
const FILE_INPUT_VISUAL_CLASS = "sr-only";

/** Distance from the center of the main (+) FAB to each satellite center. */
const ORBIT_PX = 68;

/** Extra `bottom` / `right` when open so satellites stay in the viewport (hub is `fixed` in the corner). */
const DIAL_OPEN_BOTTOM_LIFT = `calc(1.5rem + ${ORBIT_PX}px + 0.75rem)`;
const DIAL_OPEN_RIGHT_LIFT = `calc(2rem + ${ORBIT_PX}px + 12px)`;

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

function isProbablyImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const name = file.name?.toLowerCase() ?? "";
  return /\.(jpg|jpeg|png|webp|gif|heic|heif|bmp)(\?|$)/i.test(name);
}

const SATELLITE_TRANSITION =
  "transform 320ms cubic-bezier(0.34, 1.25, 0.64, 1), opacity 240ms ease-out";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function Satellite({
  x,
  y,
  label,
  onClick,
  expanded,
  staggerIndex,
  reducedMotion,
  children,
}: {
  x: number;
  y: number;
  label: string;
  onClick: () => void;
  expanded: boolean;
  staggerIndex: number;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-hidden={!expanded}
      tabIndex={expanded ? 0 : -1}
      onClick={onClick}
      className={`${SATELLITE_BTN} absolute left-1/2 top-1/2 z-[1]`}
      style={{
        transform: expanded
          ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
          : "translate(-50%, -50%) scale(0.65)",
        opacity: expanded ? 1 : 0,
        pointerEvents: expanded ? "auto" : "none",
        transition: reducedMotion ? "none" : SATELLITE_TRANSITION,
        transitionDelay:
          reducedMotion || !expanded ? "0ms" : `${staggerIndex * 42}ms`,
      }}
    >
      {children}
    </button>
  );
}

function OrbitFileSatellite({
  x,
  y,
  label,
  expanded,
  staggerIndex,
  reducedMotion,
  disabled,
  capture,
  multiple,
  onChange,
  children,
}: {
  x: number;
  y: number;
  label: string;
  expanded: boolean;
  staggerIndex: number;
  reducedMotion: boolean;
  disabled: boolean;
  capture?: "environment";
  multiple?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  children: React.ReactNode;
}) {
  const inactive = disabled || !expanded;
  return (
    <label
      aria-label={label}
      aria-hidden={!expanded}
      className={`${SATELLITE_BTN} absolute left-1/2 top-1/2 z-[1] ${inactive ? "pointer-events-none opacity-45" : "cursor-pointer"}`}
      style={{
        transform: expanded
          ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
          : "translate(-50%, -50%) scale(0.65)",
        opacity: expanded ? (disabled ? 0.45 : 1) : 0,
        pointerEvents: inactive ? "none" : "auto",
        transition: reducedMotion ? "none" : SATELLITE_TRANSITION,
        transitionDelay:
          reducedMotion || !expanded ? "0ms" : `${staggerIndex * 42}ms`,
      }}
    >
      <input
        type="file"
        accept="image/*"
        className={FILE_INPUT_VISUAL_CLASS}
        tabIndex={-1}
        disabled={inactive}
        {...(capture ? { capture } : {})}
        {...(multiple ? { multiple: true } : {})}
        onChange={onChange}
      />
      {children}
    </label>
  );
}

/**
 * Desktop (md+): FAB (+) expands with jump, voice, camera, and gallery around the hub center.
 */
export function LandingDesktopJournalSpeedDial({
  onVoiceClick,
  imageHintText = "",
}: {
  onVoiceClick: () => void;
  /** Passed to image transcribe (e.g. current note draft); optional. */
  imageHintText?: string;
}) {
  const [dialOpen, setDialOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPanelId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const imageHintTextRef = useRef(imageHintText);
  imageHintTextRef.current = imageHintText;

  const closeAll = useCallback(() => {
    setDialOpen(false);
    setJumpOpen(false);
  }, []);

  const processImageFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter(isProbablyImageFile);
      if (list.length === 0) {
        window.alert("No image file was selected.");
        return;
      }
      setImageBusy(true);
      closeAll();
      onVoiceClick();
      try {
        for (const file of list) {
          if (file.size > 20 * 1024 * 1024) {
            throw new Error("An image is too large (max 20MB before compression).");
          }
          const analysis = await transcribeJournalImageFile(file, imageHintTextRef.current);
          dispatchJournalImageAnalysesBridge([analysis]);
        }
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Image import failed.");
      } finally {
        setImageBusy(false);
      }
    },
    [closeAll, onVoiceClick]
  );

  const onCameraInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (imageBusy) {
      input.value = "";
      return;
    }
    const list = input.files?.length ? Array.from(input.files) : [];
    input.value = "";
    if (list.length > 0) void processImageFiles(list);
  };

  const onGalleryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (imageBusy) {
      input.value = "";
      return;
    }
    const list = input.files?.length ? Array.from(input.files) : [];
    input.value = "";
    if (list.length > 0) void processImageFiles(list);
  };

  useEffect(() => {
    if (!dialOpen && !jumpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialOpen, jumpOpen, closeAll]);

  useEffect(() => {
    if (!dialOpen && !jumpOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      closeAll();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [dialOpen, jumpOpen, closeAll]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed z-[50] hidden overflow-visible transition-[bottom,right] duration-300 ease-out md:block"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        bottom: dialOpen ? DIAL_OPEN_BOTTOM_LIFT : "1.5rem",
        right: dialOpen ? DIAL_OPEN_RIGHT_LIFT : "2rem",
      }}
    >
      <div className="pointer-events-auto relative inline-flex flex-col items-end overflow-visible">
        {jumpOpen && (
          <div
            id={menuPanelId}
            role="menu"
            aria-label="Dashboard sections"
            className="absolute bottom-full right-0 z-[51] mb-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/35 bg-white/55 p-2 shadow-xl backdrop-blur-xl animate-fade-in-up motion-reduce:animate-none dark:border-white/10 dark:bg-neutral-900/50"
          >
            <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-400">
              Jump to section
            </p>
            <ul className="max-h-[min(50vh,22rem)] space-y-0.5 overflow-y-auto">
              {LANDING_DASHBOARD_SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-white/60 dark:hover:bg-white/10"
                    onClick={() => {
                      scrollToLandingDashboardSection(s.id);
                      closeAll();
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Hub: main (+) is the geometric center; satellites orbit this point */}
        <div className="relative inline-block overflow-visible">
          <Satellite
            x={0}
            y={-ORBIT_PX}
            staggerIndex={0}
            reducedMotion={reducedMotion}
            expanded={dialOpen}
            label="Jump to dashboard section"
            onClick={() => {
              setDialOpen(false);
              setJumpOpen((v) => !v);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
          </Satellite>
          <Satellite
            x={0}
            y={ORBIT_PX}
            staggerIndex={1}
            reducedMotion={reducedMotion}
            expanded={dialOpen}
            label="Brain dump — speak with Gemini"
            onClick={() => {
              closeAll();
              onVoiceClick();
            }}
          >
            <SparklesIcon className="h-[18px] w-[18px]" />
          </Satellite>
          <OrbitFileSatellite
            x={-ORBIT_PX}
            y={0}
            staggerIndex={2}
            reducedMotion={reducedMotion}
            expanded={dialOpen}
            disabled={imageBusy}
            capture="environment"
            label="Capture photo for journal"
            onChange={onCameraInputChange}
          >
            <CameraGlyph className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
          </OrbitFileSatellite>
          <OrbitFileSatellite
            x={ORBIT_PX}
            y={0}
            staggerIndex={3}
            reducedMotion={reducedMotion}
            expanded={dialOpen}
            disabled={imageBusy}
            multiple
            label="Add photos from library"
            onChange={onGalleryInputChange}
          >
            <PhotosGlyph className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
          </OrbitFileSatellite>

          <button
            type="button"
            aria-expanded={dialOpen}
            aria-haspopup="true"
            aria-controls={jumpOpen ? menuPanelId : undefined}
            className="relative z-[2] flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 [-webkit-tap-highlight-color:transparent]"
            onClick={() => {
              setJumpOpen(false);
              setDialOpen((v) => !v);
            }}
            aria-label={dialOpen ? "Close quick actions" : "Open quick actions"}
          >
            {dialOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
