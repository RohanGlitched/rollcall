"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, type Hex } from "viem";
import { runNdt7 } from "@/lib/ndt7";
import { DOMAIN, READING_TYPES, txUrl } from "@/lib/chain";
import type { TermView } from "@/lib/server/reads";
import { mbps } from "@/lib/days";

const KEY = "rollcall.kit.key.v1";
const SALT = "rollcall.kit.salt.v1";
const TERM = "rollcall.kit.term.v1";
const QUEUE = "rollcall.kit.queue.v1";
const LOG = "rollcall.kit.log.v1";
const RETRY_MS = 15 * 60_000;

type Queued = { termId: number; takenAt: number; id: string };
type Entry = { at: number; text: string; ok: boolean; tx?: string };

function load<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
}
function save(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}
function keyOf(): Hex {
  const k = load<string | null>(KEY, null);
  if (k && /^0x[0-9a-f]{64}$/i.test(k)) return k as Hex;
  const n = generatePrivateKey();
  save(KEY, n);
  return n;
}
function saltOf(): string {
  const s = load<string | null>(SALT, null);
  if (s) return s;
  const n = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  save(SALT, n);
  return n;
}

/** A school probe that runs in a browser tab on any computer that stays on in the school. */
export function ProbeKit() {
  const [addr, setAddr] = useState<string>("");
  const [termId, setTermId] = useState<string>("");
  const [term, setTerm] = useState<TermView | null>(null);
  const [termErr, setTermErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Entry[]>([]);
  const [queue, setQueue] = useState<Queued[]>([]);
  const lastTry = useRef<Record<string, number>>({});

  useEffect(() => {
    setAddr(privateKeyToAccount(keyOf()).address);
    setTermId(load<string>(TERM, ""));
    setLog(load<Entry[]>(LOG, []));
    setQueue(load<Queued[]>(QUEUE, []));
  }, []);

  const note = useCallback((e: Entry) => {
    setLog((l) => {
      const n = [e, ...l].slice(0, 60);
      save(LOG, n);
      return n;
    });
  }, []);

  const loadTerm = useCallback(async (id: string) => {
    setTermErr(null);
    if (!Number(id)) return setTerm(null);
    try {
      const r = await fetch(`/api/term/${Number(id)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setTerm(j.term);
    } catch (e) {
      setTerm(null);
      setTermErr(e instanceof Error ? e.message : "The term could not be read.");
    }
  }, []);

  useEffect(() => {
    if (termId) loadTerm(termId);
  }, [termId, loadTerm]);

  const mine = term && addr && term.terms.probe.toLowerCase() === addr.toLowerCase();

  async function sendOffline(q: Queued) {
    const acct = privateKeyToAccount(keyOf());
    const message = {
      termId: BigInt(q.termId),
      takenAt: BigInt(q.takenAt),
      downKbps: 0,
      upKbps: 0,
      rttMs: 0,
      testId: keccak256(toBytes(q.id)),
      clientHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
    };
    const sig = await acct.signTypedData({ domain: DOMAIN, types: READING_TYPES, primaryType: "Reading", message });
    const r = await fetch("/api/offline", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ termId: q.termId, takenAt: q.takenAt, id: q.id, sig }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    return j.tx as string;
  }

  async function flushQueue() {
    const q = load<Queued[]>(QUEUE, []);
    const left: Queued[] = [];
    for (const item of q) {
      try {
        const tx = await sendOffline(item);
        note({ at: Date.now(), ok: true, text: `Sent the offline report from ${new Date(item.takenAt * 1000).toLocaleTimeString()}.`, tx });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (/Failed to fetch|NetworkError|network/i.test(msg)) left.push(item);
        else note({ at: Date.now(), ok: false, text: `Offline report dropped: ${msg}` });
      }
    }
    save(QUEUE, left);
    setQueue(left);
  }

  async function testOnce() {
    if (!term || busy) return;
    setBusy(true);
    const t = term.terms;
    try {
      const res = await runNdt7(() => {});
      const salt = saltOf();
      const ids = res.upUuid ? `${res.uuid}|${res.upUuid}` : res.uuid;
      const acct = privateKeyToAccount(keyOf());
      const message = {
        termId: BigInt(term.id),
        takenAt: BigInt(res.finishedAt),
        downKbps: res.downKbps,
        upKbps: res.upKbps,
        rttMs: res.rttMs,
        testId: keccak256(toBytes(ids)),
        clientHash: keccak256(toBytes(`${salt}:${res.clientIp}`)),
      };
      const sig = await acct.signTypedData({ domain: DOMAIN, types: READING_TYPES, primaryType: "Reading", message });
      const r = await fetch("/api/reading", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          termId: term.id,
          takenAt: res.finishedAt,
          downKbps: res.downKbps,
          upKbps: res.upKbps,
          rttMs: res.rttMs,
          uuid: res.uuid,
          upUuid: res.upUuid,
          salt,
          client: res.client,
          machine: res.machine,
          sig,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      note({ at: Date.now(), ok: j.pass, text: `${mbps(res.downKbps)}/${mbps(res.upKbps)} Mbps, ${res.rttMs} ms over AS${j.asn}: ${j.pass ? "passed" : `failed (the term needs ${t.minDownKbps / 1000}/${t.minUpKbps / 1000} Mbps, ≤ ${t.maxRttMs} ms, AS${t.asn})`}.`, tx: j.tx });
      return j.pass as boolean;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The test failed.";
      // could not reach M-Lab or this site: the line is probably down. Sign what the probe saw, send it later.
      if (/could not connect|Failed to fetch|NetworkError|find a test server|network/i.test(msg)) {
        const now = Math.floor(Date.now() / 1000);
        const q = [...load<Queued[]>(QUEUE, []), { termId: term.id, takenAt: now, id: `offline:${addr.toLowerCase()}:${term.id}:${now}` }];
        save(QUEUE, q);
        setQueue(q);
        note({ at: Date.now(), ok: false, text: "No connection. An offline report is signed and will be sent when the line is back." });
      } else note({ at: Date.now(), ok: false, text: msg });
      return false;
    } finally {
      setBusy(false);
    }
  }

  // the schedule: one test at the start of each part of the school day, retried every 15 minutes until one passes
  useEffect(() => {
    if (!running || !term || !mine) return;
    const tick = async () => {
      if (load<Queued[]>(QUEUE, []).length) await flushQueue();
      const t = term.terms;
      const now = Date.now() / 1000;
      if (now < t.start || now >= t.start + t.numDays * t.dayLength) return;
      const day = Math.floor((now - t.start) / t.dayLength);
      const into = now - t.start - day * t.dayLength;
      const open = t.schoolHours || t.dayLength;
      if (into >= open) return; // school is shut: no test until tomorrow's opening
      const part = Math.floor((into * t.required) / open);
      const key = `${day}:${part}`;
      const passedKey = `passed:${key}`;
      if (lastTry.current[passedKey]) return;
      if (Date.now() - (lastTry.current[key] ?? 0) < RETRY_MS) return;
      if (term.days[day]?.closed) return;
      lastTry.current[key] = Date.now();
      const ok = await testOnce();
      if (ok) lastTry.current[passedKey] = Date.now();
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, term, mine]);

  const btn = "rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-sheet hover:bg-duct-2 disabled:opacity-50";
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <section className="rounded-2xl border border-line bg-sheet p-6 sm:p-8">
        <h2 className="text-[22px] font-bold">1. This computer’s probe key</h2>
        <p className="mt-2 text-[14.5px] text-muted">Made in this browser and kept here. Give the address to the funder who opens the term.</p>
        <p className="mt-4 break-all rounded-lg bg-ground px-4 py-3 font-mono text-[13.5px]">{addr || "…"}</p>
        <button className="mt-3 text-[13.5px] font-semibold text-ink underline underline-offset-4" onClick={() => navigator.clipboard?.writeText(addr)}>
          Copy the address
        </button>

        <h2 className="mt-10 text-[22px] font-bold">2. The term it reports to</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="w-36 rounded-lg border border-line-strong bg-white px-3 py-2.5 text-[15px]"
            placeholder="Term number"
            inputMode="numeric"
            value={termId}
            onChange={(e) => {
              setTermId(e.target.value);
              save(TERM, e.target.value);
            }}
          />
          <button className={btn} onClick={() => loadTerm(termId)}>
            Look it up
          </button>
        </div>
        {termErr && <p className="mt-3 text-[13.5px] text-fault">{termErr}</p>}
        {term && (
          <p className={`mt-3 text-[14px] ${mine ? "" : "text-fault"}`}>
            {mine
              ? `Term ${term.id}, ${term.school}: this computer is its probe. ${term.terms.required > 1 ? `The day has ${term.terms.required} parts; a test must pass in each.` : ""}`
              : `Term ${term.id} names a different probe (${term.terms.probe.slice(0, 10)}…). Ask the funder to open a term for this computer’s address.`}
          </p>
        )}

        <h2 className="mt-10 text-[22px] font-bold">3. Keep this tab open</h2>
        <p className="mt-2 text-[14.5px] text-muted">
          While it runs, the probe tests once in each part of the school day and retries every 15 minutes until a test passes. When the
          line is down it signs an offline report and sends it when the line is back, so a dead line counts against the provider and a
          switched-off computer does not.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={btn} disabled={!mine} onClick={() => setRunning((r) => !r)}>
            {running ? "Stop the probe" : "Start the probe"}
          </button>
          <button className="rounded-full border border-line-strong px-5 py-2.5 text-[14px] font-semibold hover:border-ink disabled:opacity-50" disabled={!mine || busy} onClick={testOnce}>
            {busy ? "Testing…" : "Run one test now"}
          </button>
        </div>
        {queue.length > 0 && <p className="mt-3 text-[13.5px] text-part">{queue.length} offline report{queue.length > 1 ? "s" : ""} waiting to be sent.</p>}
        <p className="mt-4 text-[12.5px] text-muted">
          M-Lab publishes every test, including the address it ran from, in its open archive. Roll Call writes only a salted hash of the
          address on chain.
        </p>
      </section>

      <section className="duct rounded-2xl p-6 sm:p-8">
        <h2 className="text-[22px] font-bold text-glass">What the probe did</h2>
        {log.length === 0 ? (
          <p className="mt-3 text-[14.5px] text-glass-muted">Nothing yet. Start the probe or run one test.</p>
        ) : (
          <ol className="mt-4 space-y-2.5">
            {log.map((e, i) => (
              <li key={i} className="text-[13.5px] leading-snug">
                <span className="text-glass-muted tnum">{new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>{" "}
                <span className={e.ok ? "text-[#8fe0b0]" : "text-[#ffb3ab]"}>{e.text}</span>{" "}
                {e.tx && (
                  <a className="text-glass-muted underline" href={txUrl(e.tx)}>
                    tx
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
