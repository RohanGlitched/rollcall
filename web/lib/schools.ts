// The demo network: six simulated schools on an accelerated clock (one school day = one hour),
// one real probe on the real calendar, and the terms visitors open from /test.
// Simulated schools use private-use network numbers (AS64512+) and test ids that start with
// "sim:", so nothing simulated can be mistaken for a real measurement on chain.

export type DayScript = "ok" | "slow" | "down" | "hotspot" | "closed" | "fake";

export type SimSchool = {
  key: string;
  name: string; // stored on chain in TermOpened.school
  place: string;
  provider: string; // fictional provider
  asn: number; // private-use ASN
  fibre: string; // TIA-598 colour name, used to draw its strand
  story: string;
  script: (day: number) => DayScript;
  closeReason?: (day: number) => string;
};

export const SIM_DAY_SECONDS = 3600;
export const SIM_DAYS = 24;
export const SIM_REQUIRED = 3;
export const SIM_RATE = 12_000_000n; // 12 tUSD a school day
export const SIM_BOND = 60_000_000n;
export const SIM_SLASH = 20_000_000n;
export const SIM_STRIKES = 5;
export const SIM_LATE = 300;
export const SIM_CHALLENGE = 300;
export const SIM_SLA = { minDownKbps: 10_000, minUpKbps: 2_000, maxRttMs: 150 };

export const SIM_SCHOOLS: SimSchool[] = [
  {
    key: "plains",
    fibre: "blue",
    name: "Town primary school, Kheda",
    place: "Gujarat",
    provider: "Plainsnet (simulated)",
    asn: 64512,
    story: "A connection that just works. The provider is paid for every day, and the funder never has to chase anyone.",
    script: (d) => (d === 9 ? "slow" : "ok"),
  },
  {
    key: "hill",
    fibre: "orange",
    name: "Hill primary school, Chamoli",
    place: "Uttarakhand",
    provider: "Ridgeline Fibre (simulated)",
    asn: 64513,
    story:
      "A landslide cuts the fibre on day 8 and nobody comes to fix it. After five silent days in a row the funder ends the term and takes back every day not yet served, plus part of the provider's bond.",
    script: (d) => (d >= 7 ? "down" : "ok"),
  },
  {
    key: "island",
    fibre: "green",
    name: "River-island school, Majuli",
    place: "Assam",
    provider: "Brahmaputra Broadband (simulated)",
    asn: 64514,
    story:
      "Floods close the school twice. The headteacher marks those days closed before they end, so the provider is not struck for them and the funder keeps the money.",
    script: (d) => (d === 5 || d === 6 || d === 15 ? "closed" : d === 11 || d === 12 ? "down" : d % 7 === 3 ? "slow" : "ok"),
    closeReason: (d) => (d === 15 ? "School closed: flood warning" : "School closed: flooding on the ferry route"),
  },
  {
    key: "forest",
    fibre: "brown",
    name: "Ashram school, Gumla",
    place: "Jharkhand",
    provider: "Sal Valley Net (simulated)",
    asn: 64515,
    story:
      "The link is up but slow. On most days only one or two of the three tests reach 10 Mbps, so the provider is paid a third or two thirds of the day.",
    script: (d) => (d % 5 === 0 ? "ok" : d % 3 === 0 ? "down" : "slow"),
  },
  {
    key: "coast",
    fibre: "slate",
    name: "Coastal school, Kendrapara",
    place: "Odisha",
    provider: "Deltaline (simulated)",
    asn: 64516,
    story:
      "When the line drops, a teacher runs the test from a phone hotspot. The speed is fine, but it came over another network, so the contracted provider earns nothing for that day.",
    script: (d) => (d === 4 || d === 13 || d === 14 ? "hotspot" : d === 20 ? "closed" : "ok"),
    closeReason: () => "School closed: cyclone warning",
  },
  {
    key: "desert",
    fibre: "violet",
    name: "Government school, Barmer",
    place: "Rajasthan",
    provider: "Thar Links (simulated)",
    asn: 64517,
    story:
      "On day 10 the readings look perfect, but their test ids are not in M-Lab's archive. The funder challenges the day, the arbiter upholds it, the day is voided and the provider loses part of its bond.",
    script: (d) => (d === 9 ? "fake" : d === 17 ? "down" : "ok"),
  },
];

export const simByName = (name: string) => SIM_SCHOOLS.find((s) => s.name === name);

export const REAL_PROBE_NAME = "Probe 0: a cloud server in India";
export const TRIAL_PREFIX = "Visitor school";

export type TermKind = "sim" | "real" | "trial" | "other";
export function kindOf(name: string): TermKind {
  if (simByName(name)) return "sim";
  if (name === REAL_PROBE_NAME) return "real";
  if (name.startsWith(TRIAL_PREFIX)) return "trial";
  return "other";
}

// Visitor terms: three two-minute school days, so a whole term plays out while you watch.
export const TRIAL = {
  dayLength: 120,
  numDays: 3,
  required: 1,
  lateWindow: 30,
  challengeWindow: 20,
  strikeLimit: 2,
  rate: 10_000_000n,
  bond: 20_000_000n,
  slash: 5_000_000n,
  sla: { minDownKbps: 5_000, minUpKbps: 1_000, maxRttMs: 150 },
  leadSeconds: 18,
};

export const FIBRE: Record<string, string> = {
  blue: "#3d8bff",
  orange: "#ff8a2a",
  green: "#2fcb74",
  brown: "#c08a55",
  slate: "#9fb2c2",
  violet: "#a585ff",
  rose: "#ff8fb8",
  aqua: "#34d1dd",
};
/** Strand colour for a term: simulated schools keep theirs, Probe 0 is aqua, visitors are rose. */
export function fibreOf(name: string): { name: string; hex: string } {
  const sim = simByName(name);
  const n = sim ? sim.fibre : name === REAL_PROBE_NAME ? "aqua" : "rose";
  return { name: n, hex: FIBRE[n] };
}
