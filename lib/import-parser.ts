import type { HabitBucket } from "./habit-buckets";
import { isHabitBucket } from "./habit-buckets";

// ---------------------------------------------------------------------------
// Row types for each importable section
// ---------------------------------------------------------------------------

export interface NutritionImportRow {
  date: string;
  time: string;
  description: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  caffeine: number | null;
  tag: string;
  notes: string;
  _valid: boolean;
  _error?: string;
}

export interface ExerciseImportRow {
  date: string;
  time: string;
  description: string;
  duration: number | null;
  caloriesBurned: number | null;
  tag: string;
  notes: string;
  _valid: boolean;
  _error?: string;
}

export interface WeightImportRow {
  date: string;
  weightKg: number;
  _valid: boolean;
  _error?: string;
}

export interface SleepImportRow {
  date: string;
  hours: number;
  hrvMs: number | null;
  _valid: boolean;
  _error?: string;
}

export interface FocusImportRow {
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  tag: string;
  _valid: boolean;
  _error?: string;
}

export interface HabitImportRow {
  name: string;
  description: string;
  bucket: HabitBucket;
  _valid: boolean;
  _error?: string;
}

export interface HabitCompletionImportRow {
  habitName: string;
  date: string;
  _valid: boolean;
  _error?: string;
}

export interface ReflectionImportRow {
  date: string;
  time: string;
  text: string;
  _valid: boolean;
  _error?: string;
}

export interface GoalImportRow {
  setting: string;
  value: number;
  _valid: boolean;
  _error?: string;
}

export interface ConceptImportRow {
  title: string;
  summary: string;
  _valid: boolean;
  _error?: string;
}

export interface ImportPayload {
  nutrition: NutritionImportRow[];
  exercise: ExerciseImportRow[];
  weight: WeightImportRow[];
  sleep: SleepImportRow[];
  focus: FocusImportRow[];
  habits: HabitImportRow[];
  habitCompletions: HabitCompletionImportRow[];
  reflections: ReflectionImportRow[];
  goals: GoalImportRow[];
  concepts: ConceptImportRow[];
  warnings: string[];
}

export type ImportSectionKey = keyof Omit<ImportPayload, "warnings">;

export const IMPORT_SECTION_META: Record<
  ImportSectionKey,
  { label: string; icon: string }
> = {
  nutrition: { label: "Nutrition", icon: "🍎" },
  exercise: { label: "Exercise", icon: "🏃" },
  weight: { label: "Weight", icon: "⚖️" },
  sleep: { label: "Sleep", icon: "😴" },
  focus: { label: "Focus", icon: "🎯" },
  habits: { label: "Habits", icon: "✅" },
  habitCompletions: { label: "Habit Completions", icon: "📅" },
  reflections: { label: "Reflections", icon: "📝" },
  goals: { label: "Goals", icon: "🎯" },
  concepts: { label: "Concepts", icon: "💡" },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

function parseNum(raw: string): number | null {
  if (!raw || raw.trim().toLowerCase() === "unknown") return null;
  const n = Number(raw.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function requireNum(raw: string): number | null {
  const n = parseNum(raw);
  return n !== null && n >= 0 ? n : null;
}

function isValidDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime());
}

function isValidTime(s: string): boolean {
  return TIME_RE.test(s);
}

/**
 * Parse a markdown table into an array of maps.
 * Each map has lowercase-trimmed header keys -> cell values.
 */
function parseMarkdownTable(block: string): Record<string, string>[] {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine
    .split("|")
    .map((h) => h.trim())
    .filter(Boolean);

  // Skip the separator line (index 1) which contains dashes
  const dataLines = lines.slice(2);
  const rows: Record<string, string>[] = [];

  for (const line of dataLines) {
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length); // drop leading/trailing empty splits
    if (cells.length === 0) continue;
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i].toLowerCase()] = cells[i] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Split the markdown input into named sections.
 * Returns a map from section name (lowercase) to its body text.
 */
function splitSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  const parts = markdown.split(/^##\s+/m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;
    const name = part.slice(0, newlineIdx).trim().toLowerCase();
    const body = part.slice(newlineIdx + 1);
    sections.set(name, body);
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

function parseNutritionSection(body: string): NutritionImportRow[] {
  return parseMarkdownTable(body).map((r) => {
    const date = (r["date"] ?? "").trim();
    const time = (r["time"] ?? "").trim();
    const description = (r["description"] ?? "").trim();
    const row: NutritionImportRow = {
      date,
      time,
      description,
      calories: parseNum(r["calories (kcal)"] ?? r["calories"] ?? ""),
      protein: parseNum(r["protein (g)"] ?? r["protein"] ?? ""),
      carbs: parseNum(r["carbs (g)"] ?? r["carbs"] ?? ""),
      fat: parseNum(r["fat (g)"] ?? r["fat"] ?? ""),
      fiber: parseNum(r["fiber (g)"] ?? r["fiber"] ?? ""),
      sugar: parseNum(r["sugar (g)"] ?? r["sugar"] ?? ""),
      sodium: parseNum(r["sodium (mg)"] ?? r["sodium"] ?? ""),
      caffeine: parseNum(r["caffeine (mg)"] ?? r["caffeine"] ?? ""),
      tag: (r["tag"] ?? "").trim(),
      notes: (r["notes"] ?? "").trim(),
      _valid: true,
    };
    if (!isValidDate(date)) {
      row._valid = false;
      row._error = `Invalid date: ${date}`;
    } else if (!description) {
      row._valid = false;
      row._error = "Missing description";
    }
    return row;
  });
}

function parseExerciseSection(body: string): ExerciseImportRow[] {
  return parseMarkdownTable(body).map((r) => {
    const date = (r["date"] ?? "").trim();
    const time = (r["time"] ?? "").trim();
    const description = (r["description"] ?? "").trim();
    const row: ExerciseImportRow = {
      date,
      time,
      description,
      duration: parseNum(r["duration (min)"] ?? r["duration"] ?? ""),
      caloriesBurned: parseNum(
        r["calories burned (kcal)"] ?? r["calories burned"] ?? ""
      ),
      tag: (r["tag"] ?? "").trim(),
      notes: (r["notes"] ?? "").trim(),
      _valid: true,
    };
    if (!isValidDate(date)) {
      row._valid = false;
      row._error = `Invalid date: ${date}`;
    } else if (!description) {
      row._valid = false;
      row._error = "Missing description";
    }
    return row;
  });
}

function parseWeightSection(body: string): WeightImportRow[] {
  return parseMarkdownTable(body).map((r) => {
    const date = (r["date"] ?? "").trim();
    const wRaw = r["weight (kg)"] ?? r["weight"] ?? "";
    const weightKg = requireNum(wRaw);
    const row: WeightImportRow = {
      date,
      weightKg: weightKg ?? 0,
      _valid: true,
    };
    if (!isValidDate(date)) {
      row._valid = false;
      row._error = `Invalid date: ${date}`;
    } else if (weightKg === null || weightKg <= 0) {
      row._valid = false;
      row._error = `Invalid weight: ${wRaw}`;
    }
    return row;
  });
}

function parseSleepSection(body: string): SleepImportRow[] {
  return parseMarkdownTable(body).map((r) => {
    const date = (r["date"] ?? "").trim();
    const hRaw = r["hours"] ?? "";
    const hours = requireNum(hRaw);
    const row: SleepImportRow = {
      date,
      hours: hours ?? 0,
      hrvMs: parseNum(r["hrv (ms)"] ?? r["hrv"] ?? ""),
      _valid: true,
    };
    if (!isValidDate(date)) {
      row._valid = false;
      row._error = `Invalid date: ${date}`;
    } else if (hours === null || hours <= 0) {
      row._valid = false;
      row._error = `Invalid hours: ${hRaw}`;
    }
    return row;
  });
}

function parseFocusSection(body: string): FocusImportRow[] {
  return parseMarkdownTable(body).map((r) => {
    const date = (r["date"] ?? "").trim();
    const startTime = (r["start time"] ?? "").trim();
    const endTime = (r["end time"] ?? "").trim();
    const dRaw = r["duration (min)"] ?? r["duration"] ?? "";
    const duration = requireNum(dRaw);
    const row: FocusImportRow = {
      date,
      startTime,
      endTime,
      duration: duration ?? 0,
      tag: (r["tag"] ?? "").trim(),
      _valid: true,
    };
    if (!isValidDate(date)) {
      row._valid = false;
      row._error = `Invalid date: ${date}`;
    } else if (!isValidTime(startTime) || !isValidTime(endTime)) {
      row._valid = false;
      row._error = `Invalid time: ${startTime} - ${endTime}`;
    } else if (duration === null || duration <= 0) {
      row._valid = false;
      row._error = `Invalid duration: ${dRaw}`;
    }
    return row;
  });
}

function parseHabitsSection(body: string): HabitImportRow[] {
  return parseMarkdownTable(body).map((r) => {
    const name = (r["name"] ?? "").trim();
    const description = (r["description"] ?? "").trim();
    const bucketRaw = (r["bucket"] ?? "wellbeing").trim().toLowerCase();
    const bucket = isHabitBucket(bucketRaw) ? bucketRaw : "wellbeing";
    const row: HabitImportRow = {
      name,
      description,
      bucket,
      _valid: true,
    };
    if (!name) {
      row._valid = false;
      row._error = "Missing habit name";
    }
    if (!isHabitBucket(bucketRaw)) {
      row._error = `Unknown bucket "${bucketRaw}", defaulting to "wellbeing"`;
    }
    return row;
  });
}

function parseHabitCompletionsSection(
  body: string
): HabitCompletionImportRow[] {
  return parseMarkdownTable(body).map((r) => {
    const habitName = (r["habit name"] ?? "").trim();
    const date = (r["date"] ?? "").trim();
    const row: HabitCompletionImportRow = {
      habitName,
      date,
      _valid: true,
    };
    if (!habitName) {
      row._valid = false;
      row._error = "Missing habit name";
    } else if (!isValidDate(date)) {
      row._valid = false;
      row._error = `Invalid date: ${date}`;
    }
    return row;
  });
}

function parseReflectionsSection(body: string): ReflectionImportRow[] {
  return parseMarkdownTable(body).map((r) => {
    const date = (r["date"] ?? "").trim();
    const time = (r["time"] ?? "").trim();
    const text = (r["text"] ?? "").trim();
    const row: ReflectionImportRow = {
      date,
      time,
      text,
      _valid: true,
    };
    if (!isValidDate(date)) {
      row._valid = false;
      row._error = `Invalid date: ${date}`;
    } else if (!text) {
      row._valid = false;
      row._error = "Missing reflection text";
    }
    return row;
  });
}

const VALID_GOAL_SETTINGS = new Set([
  "daily calories target",
  "daily protein target (g)",
  "daily carbs target (g)",
  "daily fat target (g)",
  "target weight (kg)",
]);

function parseGoalsSection(body: string): GoalImportRow[] {
  return parseMarkdownTable(body).map((r) => {
    const setting = (r["setting"] ?? "").trim();
    const vRaw = r["value"] ?? "";
    const value = requireNum(vRaw);
    const row: GoalImportRow = {
      setting,
      value: value ?? 0,
      _valid: true,
    };
    if (!VALID_GOAL_SETTINGS.has(setting.toLowerCase())) {
      row._valid = false;
      row._error = `Unknown goal setting: "${setting}"`;
    } else if (value === null || value <= 0) {
      row._valid = false;
      row._error = `Invalid value: ${vRaw}`;
    }
    return row;
  });
}

function parseConceptsSection(body: string): ConceptImportRow[] {
  return parseMarkdownTable(body).map((r) => {
    const title = (r["title"] ?? "").trim();
    const summary = (r["summary"] ?? "").trim();
    const row: ConceptImportRow = {
      title,
      summary,
      _valid: true,
    };
    if (!title) {
      row._valid = false;
      row._error = "Missing concept title";
    } else if (!summary) {
      row._valid = false;
      row._error = "Missing concept summary";
    }
    return row;
  });
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseImportMarkdown(markdown: string): ImportPayload {
  const sections = splitSections(markdown);
  const warnings: string[] = [];

  const payload: ImportPayload = {
    nutrition: [],
    exercise: [],
    weight: [],
    sleep: [],
    focus: [],
    habits: [],
    habitCompletions: [],
    reflections: [],
    goals: [],
    concepts: [],
    warnings,
  };

  const sectionMap: Record<string, { key: ImportSectionKey; parser: (body: string) => unknown[] }> = {
    nutrition: { key: "nutrition", parser: parseNutritionSection },
    exercise: { key: "exercise", parser: parseExerciseSection },
    weight: { key: "weight", parser: parseWeightSection },
    sleep: { key: "sleep", parser: parseSleepSection },
    focus: { key: "focus", parser: parseFocusSection },
    habits: { key: "habits", parser: parseHabitsSection },
    "habit completions": { key: "habitCompletions", parser: parseHabitCompletionsSection },
    reflections: { key: "reflections", parser: parseReflectionsSection },
    goals: { key: "goals", parser: parseGoalsSection },
    concepts: { key: "concepts", parser: parseConceptsSection },
  };

  for (const [sectionName, body] of sections) {
    const mapped = sectionMap[sectionName];
    if (mapped) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload as any)[mapped.key] = mapped.parser(body);
      } catch {
        warnings.push(`Failed to parse "${sectionName}" section`);
      }
    }
  }

  const totalRows = Object.values(payload)
    .filter(Array.isArray)
    .reduce((sum, arr) => sum + arr.length, 0);

  if (totalRows === 0) {
    warnings.push(
      "No data found. Make sure the markdown has ## section headers and pipe-delimited tables."
    );
  }

  return payload;
}
