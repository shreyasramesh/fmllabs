/**
 * Split completed sentences from the current draft while typing.
 * Commits when . ! ? are followed by whitespace, or when the only segment ends with . ! ?
 */
export function flushSentencesFromTyping(draft: string): { commits: string[]; rest: string } {
  if (!draft) return { commits: [], rest: "" };
  const segments = draft.split(/(?<=[.!?])\s+/);
  if (segments.length === 0) return { commits: [], rest: draft };

  const lastSegment = segments[segments.length - 1] ?? "";
  const trimmedLast = lastSegment.trimEnd();
  const lastIsComplete = trimmedLast.length > 0 && /[.!?]$/.test(trimmedLast);

  const complete = segments
    .slice(0, -1)
    .map((s) => s.trim())
    .filter(Boolean);

  if (complete.length > 0) {
    if (lastIsComplete) {
      return { commits: [...complete, trimmedLast], rest: "" };
    }
    return { commits: complete, rest: lastSegment.trimStart() };
  }

  if (segments.length === 1 && lastIsComplete) {
    return { commits: [trimmedLast], rest: "" };
  }

  return { commits: [], rest: draft };
}

/** Split stored nutrition text into sentences (newlines + sentence boundaries). */
export function splitIntoSentences(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const byLine = text.split(/\n/).flatMap((line) => {
    const s = line.trim();
    if (!s) return [];
    const parts = s.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
    return parts.length ? parts : [s];
  });
  return byLine;
}

export function looksLikeFoodSentence(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 280) return false;
  const foodish =
    /\b(ate|eating|eaten|breakfast|lunch|dinner|snack|drink|coffee|tea|protein|kcal|calories|\bcal\b|bowl|shake|eggs|chicken|salad|rice|oatmeal|smoothie|burger|fries|latte|ramen|soup|sandwich|toast|pizza|fruit|yogurt|bar\b|meal|had|grams?|oz\b|cup|slice|scoop)\b/i;
  return foodish.test(t) || /\d/.test(t);
}

/** Activity / workout phrasing — triggers quick estimate for calories burned (shown negative in UI). */
export function looksLikeExerciseSentence(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 280) return false;
  return /\b(run|ran|running|jog|jogging|jogged|walk|walked|walking|hike|hiked|hiking|bike|biked|biking|cycling|cycle|swim|swam|swimming|gym|workout|work\s*out|lifting|lifted|squat|squats|deadlift|cardio|rowing|rowed|elliptical|treadmill|exercise|exercised|yoga|pilates|stretch|hiit|crossfit|sports|tennis|golf|ski|skied|surf|climb|climbing|push\s*ups|pull\s*ups|reps|sets)\b/i.test(
    t
  ) || /\b\d+(\.\d+)?\s*(mi|mile|miles|km|k|min|mins|minutes|hr|hrs|hours)\b/i.test(t);
}

/** Call nutrition-quick-estimate when the line could be food intake or exercise burn. */
export function shouldRunQuickEstimate(s: string): boolean {
  return looksLikeFoodSentence(s) || looksLikeExerciseSentence(s);
}
