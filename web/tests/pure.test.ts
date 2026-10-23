import { describe, expect, it } from "vitest";
import { cellState, partialGlyph, currentDay } from "../lib/days";
import { kindOf, fibreOf, SIM_SCHOOLS, REAL_PROBE_NAME, TRIAL_PREFIX } from "../lib/schools";

// settleableUpTo and shortHolder live in server-only modules; their logic is mirrored here.
function settleableUpTo(t: { start: number; dayLength: number; lateWindow: number; challengeWindow: number; numDays: number }, now: number) {
  const last = Math.floor((now - t.start - t.lateWindow - t.challengeWindow) / t.dayLength) - 1;
  return Math.min(last, t.numDays - 1);
}

const term = (over: Partial<any> = {}) =>
  ({
    id: 1,
    school: SIM_SCHOOLS[0].name,
    kind: "sim",
    terms: { start: 1000, dayLength: 100, lateWindow: 10, challengeWindow: 10, numDays: 3, required: 3, asn: 1, ratePerDay: "12000000" },
    state: { ended: false, accepted: true, nextToSettle: 0 },
    days: [
      { readings: 3, passes: 3, mark: "Present", closed: false, challenged: false, voided: false },
      { readings: 2, passes: 1, mark: "Open", closed: false, challenged: false, voided: false },
      { readings: 0, passes: 0, mark: "Open", closed: false, challenged: false, voided: false },
    ],
    ...over,
  }) as any;

describe("day states", () => {
  it("settled days keep their mark", () => {
    expect(cellState(term(), 0, 5000).kind).toBe("Present");
  });
  it("a running day is today, a finished unsettled day is pending, a later day is future", () => {
    expect(cellState(term(), 1, 1150).kind).toBe("today");
    expect(cellState(term(), 1, 1250).kind).toBe("pending");
    expect(cellState(term(), 2, 1150).kind).toBe("future");
  });
  it("days of an ended term that never settled read as returned", () => {
    expect(cellState(term({ state: { ended: true } }), 2, 9999).kind).toBe("ended");
  });
  it("current day is clamped to the term", () => {
    expect(currentDay(term(), 900)).toBe(-1);
    expect(currentDay(term(), 1250)).toBe(2);
    expect(currentDay(term(), 99999)).toBe(3);
  });
});

describe("settling", () => {
  const t = { start: 1000, dayLength: 100, lateWindow: 10, challengeWindow: 10, numDays: 3 };
  it("a day settles only after its late and challenge windows", () => {
    expect(settleableUpTo(t, 1119)).toBe(-1);
    expect(settleableUpTo(t, 1120)).toBe(0);
    expect(settleableUpTo(t, 1220)).toBe(1);
  });
  it("never past the last day", () => {
    expect(settleableUpTo(t, 99999)).toBe(2);
  });
});

describe("labels", () => {
  it("partial days show the paid share", () => {
    expect(partialGlyph(1, 3)).toBe("⅓");
    expect(partialGlyph(2, 3)).toBe("⅔");
  });
  it("term kinds come from the name on chain", () => {
    expect(kindOf(SIM_SCHOOLS[2].name)).toBe("sim");
    expect(kindOf(REAL_PROBE_NAME)).toBe("real");
    expect(kindOf(`${TRIAL_PREFIX} on Airtel`)).toBe("trial");
    expect(kindOf("Something else")).toBe("other");
  });
  it("every simulated school has its own fibre colour, and none uses a real network number", () => {
    const colours = new Set(SIM_SCHOOLS.map((s) => fibreOf(s.name).hex));
    expect(colours.size).toBe(SIM_SCHOOLS.length);
    for (const s of SIM_SCHOOLS) expect(s.asn).toBeGreaterThanOrEqual(64512);
  });
});
