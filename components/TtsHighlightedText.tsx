"use client";

export function TtsHighlightedText({ text, charEnd }: { text: string; charEnd: number }) {
  const words: { text: string; start: number; end: number }[] = [];
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    words.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }
  let currentWordIdx = -1;
  if (charEnd >= 0 && words.length > 0) {
    for (let i = 0; i < words.length; i++) {
      if (charEnd >= words[i].start && charEnd < words[i].end) {
        currentWordIdx = i;
        break;
      }
      if (charEnd >= words[i].end && (i === words.length - 1 || charEnd < words[i + 1].start)) {
        currentWordIdx = i;
        break;
      }
    }
  }
  let pos = 0;
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (pos < w.start) {
      parts.push(text.slice(pos, w.start));
    }
    parts.push(
      <span
        key={i}
        className={currentWordIdx === i ? "bg-amber-200/60 dark:bg-amber-500/30 rounded px-0.5 -mx-0.5" : undefined}
      >
        {w.text}
      </span>
    );
    pos = w.end;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return <>{parts}</>;
}
