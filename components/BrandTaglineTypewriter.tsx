"use client";

import { useEffect, useState } from "react";

const START = "f*** my life";
const FINAL = "fix my life";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function BrandTaglineTypewriter({ className }: { className?: string }) {
  const [text, setText] = useState(START);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setText(FINAL);
      return;
    }

    let cancelled = false;

    const HOLD_ON_FINAL_MS = 5_000;

    async function run() {
      while (!cancelled) {
        setText(START);
        await sleep(1_600);
        if (cancelled) return;
        let s = START;
        const keep = "f";
        while (s.length > keep.length && !cancelled) {
          s = s.slice(0, -1);
          setText(s);
          await sleep(52);
        }
        const suffix = "ix my life";
        for (let i = 0; i < suffix.length; i++) {
          if (cancelled) return;
          s = keep + suffix.slice(0, i + 1);
          setText(s);
          await sleep(52);
        }
        await sleep(HOLD_ON_FINAL_MS);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className={className}>
      <span aria-hidden>{text}</span>
      <span className="sr-only">{FINAL}</span>
    </span>
  );
}
