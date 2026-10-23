// Cross-checks every real Roll Call reading against M-Lab's public archive (BigQuery, measurement-lab.ndt.ndt7).
// For each real test id on chain it looks up M-Lab's own row: download speed and client network as M-Lab's
// server recorded them. Writes lib/archive.json, which /verify and the term pages show.
// Needs the bq CLI signed in to an account that joined M-Lab's discuss group. Runs bq through PowerShell.
// node scripts/archive-check.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SITE = process.env.SITE || "https://rollcall-schools.vercel.app";
const OUT = new URL("../lib/archive.json", import.meta.url);

const index = await (await fetch(`${SITE}/api/terms-index`)).json();
const termIds = new Set(index.ids);

const readings = [];
for (const id of termIds) {
  const j = await (await fetch(`${SITE}/api/term/${id}`)).json();
  for (const r of j.readings ?? []) {
    if (r.testId.startsWith("sim:") || r.testId.startsWith("offline:")) continue;
    readings.push({ termId: id, ...r });
  }
}
const ids = [...new Set(readings.flatMap((r) => r.testId.split("|")))];
console.log(`${readings.length} real readings, ${ids.length} test ids`);
if (!ids.length) process.exit(0);

// test ids carry the server start time in seconds: ndt-<pod>_<unix>_<counter>; query the matching dates only
const dates = [...new Set(readings.map((r) => new Date(r.takenAt * 1000).toISOString().slice(0, 10)))].sort();
const sql = `SELECT id, CAST(date AS STRING) AS date, a.MeanThroughputMbps AS mbps, a.MinRTT AS min_rtt, client.Network.ASNumber AS asn
FROM \`measurement-lab.ndt.ndt7\`
WHERE date IN (${dates.map((d) => `DATE '${d}'`).join(", ")}) AND id IN (${ids.map((i) => `'${i}'`).join(", ")})`;
const ps = `bq query --use_legacy_sql=false --format=json --max_rows=10000 "${sql.replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
const raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const rows = JSON.parse(raw.slice(raw.indexOf("[")));
const byId = new Map(rows.map((r) => [r.id, r]));

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { readings: {} };
const out = { checkedAt: new Date().toISOString(), datesQueried: dates, readings: { ...prev.readings } };
for (const r of readings) {
  const [down] = r.testId.split("|");
  const m = byId.get(down);
  out.readings[r.testId] = m
    ? { found: true, termId: r.termId, signedMbps: r.downKbps / 1000, archiveMbps: Number(m.mbps), signedAsn: r.asn, archiveAsn: Number(m.asn), date: m.date }
    : { found: false, termId: r.termId, signedMbps: r.downKbps / 1000, signedAsn: r.asn, date: new Date(r.takenAt * 1000).toISOString().slice(0, 10) };
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
const found = Object.values(out.readings).filter((x) => x.found).length;
console.log(`found ${found} of ${Object.keys(out.readings).length} in M-Lab's archive`);
