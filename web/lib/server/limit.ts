import "server-only";

// Per-instance limits. Serverless instances do not share memory, so these are a brake, not a wall;
// the house wallet's gas reserve (see /api/health) is the hard stop.
const hits = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const k of hits.keys()) if (!k.endsWith(":all")) hits.delete(k);
  return true;
}

/** Rate-limit key for an address: IPv6 by its /64 (one household or phone), IPv4 as is. */
export function ipKey(ip: string): string {
  if (!ip.includes(":")) return ip || "local";
  const parts = ip.split(":");
  return parts.slice(0, 4).join(":") + "::/64";
}
