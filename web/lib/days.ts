import type { TermView } from "./server/reads";

export type CellState =
  | { kind: "future" }
  | { kind: "today"; readings: number; passes: number; closed: boolean }
  | { kind: "pending"; readings: number; passes: number; closed: boolean; challenged: boolean; voided: boolean }
  | { kind: "Present" | "Partial" | "Absent" | "Silent" | "Closed" | "Voided"; readings: number; passes: number }
  | { kind: "ended" };

export function cellState(t: TermView, d: number, now: number): CellState {
  const day = t.days[d];
  const start = t.terms.start + d * t.terms.dayLength;
  const end = start + t.terms.dayLength;
  if (day && day.mark !== "Open") return { kind: day.mark, readings: day.readings, passes: day.passes } as CellState;
  if (t.state.ended) return { kind: "ended" };
  if (now < start) return { kind: "future" };
  if (now < end) return { kind: "today", readings: day?.readings ?? 0, passes: day?.passes ?? 0, closed: !!day?.closed };
  return {
    kind: "pending",
    readings: day?.readings ?? 0,
    passes: day?.passes ?? 0,
    closed: !!day?.closed,
    challenged: !!day?.challenged,
    voided: !!day?.voided,
  };
}

export function currentDay(t: TermView, now: number) {
  if (now < t.terms.start) return -1;
  return Math.min(Math.floor((now - t.terms.start) / t.terms.dayLength), t.terms.numDays);
}

export const usd = (units: string | number | bigint, digits = 2) =>
  (Number(units) / 1e6).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const mbps = (kbps: number) => (kbps / 1000).toLocaleString("en-US", { maximumFractionDigits: kbps < 10_000 ? 1 : 0 });

export function partialGlyph(passes: number, required: number) {
  const n = Math.min(passes, required);
  if (required === 3) return n === 1 ? "⅓" : "⅔";
  if (required === 2) return "½";
  if (required === 4) return n === 1 ? "¼" : n === 2 ? "½" : "¾";
  return `${n}/${required}`;
}

export const MARK_WORDS: Record<string, string> = {
  Present: "Present: every required test passed, paid in full",
  Partial: "Partial: some tests passed, paid pro rata",
  Absent: "Absent: tests ran but failed, refunded to the funder",
  Silent: "Silent: no test reached the ledger, refunded",
  Closed: "Closed by the school (holiday, flood, power cut): refunded, no strike",
  Voided: "Voided: a challenge was upheld, refunded and the provider's bond cut",
};

export function ago(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}
