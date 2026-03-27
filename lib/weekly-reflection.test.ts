import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWeeklyReflectionAggregate,
  getCurrentWeekWindow,
  isSundayTenAmInTimeZone,
  shiftDayKey,
} from "./weekly-reflection";

describe("lib/weekly-reflection", () => {
  it("computes week window with Sunday start", () => {
    const now = new Date("2026-03-29T14:00:00.000Z"); // Sunday morning in ET
    const week = getCurrentWeekWindow(now, "America/New_York");
    assert.equal(week.weekStartDayKey, "2026-03-29");
    assert.equal(week.weekEndDayKey, "2026-04-04");
  });

  it("detects Sunday 10AM in timezone", () => {
    const shouldRun = isSundayTenAmInTimeZone(
      new Date("2026-03-29T14:00:00.000Z"),
      "America/New_York"
    );
    const shouldNotRun = isSundayTenAmInTimeZone(
      new Date("2026-03-29T15:00:00.000Z"),
      "America/New_York"
    );
    assert.equal(shouldRun, true);
    assert.equal(shouldNotRun, false);
  });

  it("builds aggregate and filters followed mentor reflections", () => {
    const aggregate = buildWeeklyReflectionAggregate({
      transcripts: [
        {
          _id: "t1",
          userId: "u1",
          videoId: "journal_1",
          sourceType: "journal",
          transcriptText: "I felt anxious but got back to my routine and planned my week.",
          journalEntryYear: 2026,
          journalEntryMonth: 3,
          journalEntryDay: 30,
          journalMentorReflections: [
            { figureId: "f1", figureName: "Mentor A", reflection: "Keep showing up." },
            { figureId: "f2", figureName: "Mentor B", reflection: "Pause and simplify." },
          ],
          createdAt: new Date("2026-03-30T12:00:00.000Z"),
          updatedAt: new Date("2026-03-30T12:00:00.000Z"),
        },
      ],
      followedFigureIds: ["f2"],
      now: new Date("2026-04-01T12:00:00.000Z"),
      timeZone: "America/New_York",
    });
    assert.equal(aggregate.journalEntries.length, 1);
    assert.deepEqual(aggregate.emotionSignals, ["stress or overwhelm"]);
    assert.ok(aggregate.behaviorSignals.includes("routine building"));
    assert.equal(aggregate.followedMentorReflections.length, 1);
    assert.equal(aggregate.followedMentorReflections[0]?.figureId, "f2");
  });

  it("supports empty weeks", () => {
    const aggregate = buildWeeklyReflectionAggregate({
      transcripts: [],
      followedFigureIds: [],
      now: new Date("2026-04-01T12:00:00.000Z"),
      timeZone: "America/New_York",
    });
    assert.equal(aggregate.journalEntries.length, 0);
    assert.equal(aggregate.emotionSignals.length, 0);
    assert.equal(aggregate.behaviorSignals.length, 0);
    assert.equal(aggregate.followedMentorReflections.length, 0);
    assert.equal(shiftDayKey(aggregate.weekStartDayKey, 6), aggregate.weekEndDayKey);
  });
});
