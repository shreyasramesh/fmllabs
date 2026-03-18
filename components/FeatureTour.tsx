"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type TourPanelId = "conversations" | "cc" | "concepts" | "ltm" | "cg";

export interface FeatureTourStep {
  target: string;
  title: string;
  content: string;
  panel?: TourPanelId;
  ringClass?: string;
}

interface FeatureTourProps {
  steps: FeatureTourStep[];
  currentStep: number;
  onNext: () => void;
  onComplete: () => void;
  onOpenSidebar?: () => void;
  onSelectPanel?: (panel: TourPanelId | null) => void;
}

export function FeatureTour({
  steps,
  currentStep,
  onNext,
  onComplete,
  onOpenSidebar,
  onSelectPanel,
}: FeatureTourProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cutoutRect, setCutoutRect] = useState<DOMRect | null>(null);
  const step = steps[currentStep];

  useEffect(() => {
    if (typeof document === "undefined" || !step) return;
    let observer: ResizeObserver | null = null;
    const updateTargetRect = () => {
      const el = document.querySelector(step.target);
      if (!el) {
        setTargetRect(null);
        return null;
      }
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      return el;
    };
    // When switching to a panel step, wait for sidebar/panel to render
    const delay = step.panel ? 150 : 0;
    const id = setTimeout(() => {
      const el = updateTargetRect();
      if (!el) return;
      observer = new ResizeObserver(() => {
        const r = el.getBoundingClientRect();
        setTargetRect(r);
      });
      observer.observe(el);
    }, delay);
    return () => {
      clearTimeout(id);
      observer?.disconnect();
    };
  }, [step, currentStep]);

  // For panel steps, use the library modal for the cutout so it stays bright
  useEffect(() => {
    if (typeof document === "undefined" || !step) return;
    let observer: ResizeObserver | null = null;
    const updateCutout = () => {
      const modal = document.querySelector("[data-tour=library-modal]");
      if (step.panel && modal) {
        const rect = modal.getBoundingClientRect();
        setCutoutRect(rect);
        return modal;
      }
      setCutoutRect(null);
      return null;
    };
    const delay = step.panel ? 200 : 0;
    const id = setTimeout(() => {
      const el = updateCutout();
      if (el) {
        observer = new ResizeObserver(() => {
          const r = el.getBoundingClientRect();
          setCutoutRect(r);
        });
        observer.observe(el);
      }
    }, delay);
    return () => {
      clearTimeout(id);
      observer?.disconnect();
    };
  }, [step, currentStep]);

  if (!step || currentStep >= steps.length) return null;

  const isLast = currentStep === steps.length - 1;

  // Open sidebar and select panel when entering a step
  useEffect(() => {
    if (step.target === "[data-tour=sidebar-nav]" && onOpenSidebar) {
      onOpenSidebar();
      onSelectPanel?.(null);
    } else if (step.panel) {
      onOpenSidebar?.();
      onSelectPanel?.(step.panel);
    }
  }, [step.target, step.panel, onOpenSidebar, onSelectPanel]);

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      onNext();
    }
  };

  const padding = 12;
  // Use modal rect for cutout on panel steps (so modal stays bright), otherwise use target
  const rectForCutout = cutoutRect ?? targetRect;
  const cutoutLeft = rectForCutout ? rectForCutout.left - padding : 0;
  const cutoutTop = rectForCutout ? rectForCutout.top - padding : 0;
  const cutoutWidth = rectForCutout ? rectForCutout.width + padding * 2 : 0;
  const cutoutHeight = rectForCutout ? rectForCutout.height + padding * 2 : 0;

  const tooltip = (
    <div
      className="fixed inset-0 z-[70]"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Dark overlay with cutout so the highlighted modal stays bright */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        onClick={onComplete}
        aria-hidden
        style={
          rectForCutout
            ? {
                maskImage: `linear-gradient(black, black), linear-gradient(white, white)`,
                maskSize: `100% 100%, ${cutoutWidth}px ${cutoutHeight}px`,
                maskPosition: `0 0, ${cutoutLeft}px ${cutoutTop}px`,
                maskRepeat: "no-repeat",
                WebkitMaskImage: `linear-gradient(black, black), linear-gradient(white, white)`,
                WebkitMaskSize: `100% 100%, ${cutoutWidth}px ${cutoutHeight}px`,
                WebkitMaskPosition: `0 0, ${cutoutLeft}px ${cutoutTop}px`,
                WebkitMaskRepeat: "no-repeat",
                maskComposite: "exclude",
                WebkitMaskComposite: "xor",
              }
            : undefined
        }
      />
      {/* Highlight ring around target - breathing animation with step-specific colors */}
      {targetRect && (
        <div
          className={`absolute rounded-xl ring-4 ring-offset-4 ring-offset-transparent animate-tour-breathe pointer-events-none ${
            step.ringClass ?? "ring-white dark:ring-neutral-300"
          }`}
          style={{
            left: targetRect.left - 12,
            top: targetRect.top - 12,
            width: targetRect.width + 24,
            height: targetRect.height + 24,
          }}
        />
      )}
      {/* Tooltip card - fixed at bottom center */}
      <div className="fixed inset-x-0 bottom-0 z-[71] pointer-events-auto flex justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div
          className="max-w-sm w-full bg-background rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-5 animate-fade-in-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {currentStep + 1} of {steps.length}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{step.title}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            {step.content}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="px-3 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Skip tour
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(tooltip, document.body)
    : null;
}
