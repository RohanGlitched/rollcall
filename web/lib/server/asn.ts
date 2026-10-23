import "server-only";

// Which network (autonomous system) an address belongs to, from RIPEstat's public data API.
// RIPEstat answers for every region's registry, needs no key, and is what network operators use.

export type NetworkInfo = { ip: string; asn: number; prefix: string; holder: string };

const cache = new Map<string, { at: number; v: NetworkInfo }>();
const holderCache = new Map<number, string>();
const TTL = 6 * 3600_000;

async function ripe(path: string): Promise<any> {
  const r = await fetch(`https://stat.ripe.net/data/${path}&sourceapp=rollcall`, {
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`RIPEstat answered HTTP ${r.status}`);
  return r.json();
}

export function isPrivate(ip: string): boolean {
  return (
    /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ||
    /^(::1$|fc|fd|fe80)/i.test(ip) ||
    ip === "" ||
    ip === "unknown"
  );
}

export async function holderOf(asn: number): Promise<string> {
  if (holderCache.has(asn)) return holderCache.get(asn)!;
  try {
    const j = await ripe(`as-overview/data.json?resource=AS${asn}`);
    const h = String(j?.data?.holder || `AS${asn}`);
    holderCache.set(asn, h);
    return h;
  } catch {
    return `AS${asn}`;
  }
}

export async function networkOf(ip: string): Promise<NetworkInfo> {
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  if (isPrivate(ip)) throw new Error("That address is private, so its network cannot be looked up.");
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const j = await ripe(`network-info/data.json?resource=${encodeURIComponent(ip)}`);
      const asn = Number(j?.data?.asns?.[0]);
      if (!asn) throw new Error("No network is announced for this address.");
      const v: NetworkInfo = { ip, asn, prefix: String(j.data.prefix || ""), holder: await holderOf(asn) };
      cache.set(ip, { at: Date.now(), v });
      return v;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Network lookup failed.");
}

/** Trim RIPE holder strings like "JIO-AS Reliance Jio Infocomm Limited, IN" to a readable name. */
export function shortHolder(h: string): string {
  const noCc = h.replace(/,\s*[A-Z]{2}$/, "").trim();
  // RIPE holders start with the network's handle ("JIO-AS-AP Reliance Jio Infocomm Limited"); drop it
  const m = noCc.match(/^[A-Z0-9][A-Z0-9_.-]*\s+(.+)$/);
  const name = (m ? m[1] : noCc).replace(/^[-–:\s]+/, "").replace(/\s+(Limited|Ltd\.?|Pvt\.?|Private|Inc\.?|LLC|Corporation|Corp\.?)(\s|,|$).*$/i, "").trim();
  return name || h;
}

/** The caller's public address as Vercel (or a local proxy) reports it. */
export function callerIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") || "";
  const ip = xf.split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  return ip.replace(/^::ffff:/, "");
}

let devIp: string | undefined;
/** Like callerIp, but on a local dev server (no proxy in front) asks a public echo service for our address. */
export async function resolveCallerIp(req: Request): Promise<string> {
  const ip = callerIp(req);
  if (process.env.NODE_ENV === "production" || (ip && !isPrivate(ip))) return ip;
  if (devIp) return devIp;
  try {
    const r = await fetch("https://api64.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
    devIp = String((await r.json()).ip || "");
  } catch {
    devIp = "";
  }
  return devIp;
}
