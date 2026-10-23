import { NextResponse } from "next/server";
import { recoverTypedDataAddress, isHex, type Hex } from "viem";
import { DOMAIN, READING_TYPES } from "@/lib/chain";
import { recordReadings, testIdOf, clientHashOf, type ReadingInput } from "@/lib/server/actions";
import { resolveCallerIp, callerIp, networkOf, shortHolder, isPrivate } from "@/lib/server/asn";
import { plainError } from "@/lib/server/house";
import { allow, ipKey } from "@/lib/server/limit";
import { readTerm, bust } from "@/lib/server/reads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  termId: number;
  takenAt: number;
  downKbps: number;
  upKbps: number;
  rttMs: number;
  uuid: string; // download test id
  upUuid?: string; // upload test id
  salt: string; // the probe's own salt for hashing the client address
  client: string; // ip:port that M-Lab saw
  machine: string; // M-Lab host
  sig: Hex;
};

const UUID_RE = /^ndt-[a-z0-9-]+_\d+_[0-9A-F]+$/i;
const u32 = (x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < 2 ** 32;

function ipOf(client: string) {
  if (client.startsWith("[")) return client.slice(1, client.indexOf("]"));
  const colons = (client.match(/:/g) || []).length;
  if (colons > 1) return client; // a bare IPv6 address with no port
  const i = client.lastIndexOf(":");
  return i > 0 ? client.slice(0, i) : client;
}

/**
 * The attester. It records a probe-signed reading only when:
 *  1. the probe key of this term signed exactly these numbers,
 *  2. the test is a real M-Lab ndt7 test id from an M-Lab host,
 *  3. the address M-Lab saw belongs to a network, and the reading was sent from that same network,
 * and it writes the network number of that address on chain next to the reading.
 * The contract then decides pass or fail against the term's contracted network and speeds.
 */
export async function POST(req: Request) {
  const ip = await resolveCallerIp(req);
  if (!allow(`reading:${ipKey(ip)}`, 20, 600_000)) {
    return NextResponse.json({ error: "Too many readings from this network in ten minutes. Wait a little and run it again." }, { status: 429 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "The request was not valid JSON." }, { status: 400 });
  }
  if (!Number.isInteger(b.termId) || !u32(b.takenAt) || !u32(b.downKbps) || !u32(b.upKbps) || !u32(b.rttMs)) {
    return NextResponse.json({ error: "The reading is missing a number." }, { status: 400 });
  }
  if (typeof b.uuid !== "string" || !UUID_RE.test(b.uuid) || (b.upUuid !== undefined && (typeof b.upUuid !== "string" || !UUID_RE.test(b.upUuid)))) {
    return NextResponse.json({ error: "That is not an M-Lab ndt7 test id." }, { status: 400 });
  }
  if (typeof b.salt !== "string" || !/^[0-9a-f]{32,64}$/i.test(b.salt)) {
    return NextResponse.json({ error: "The reading is missing the probe's salt." }, { status: 400 });
  }
  if (typeof b.machine !== "string" || !/^[a-z0-9.-]+\.measurement-lab\.org$/i.test(b.machine)) {
    return NextResponse.json({ error: "The test did not run against an M-Lab server." }, { status: 400 });
  }
  if (typeof b.client !== "string" || !isHex(b.sig)) return NextResponse.json({ error: "The reading is not signed." }, { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - b.takenAt) > 600) {
    return NextResponse.json({ error: "The reading is more than ten minutes old. Run the test again." }, { status: 400 });
  }

  const term = await readTerm(b.termId).catch(() => null);
  if (!term) return NextResponse.json({ error: `Term ${b.termId} was not found.` }, { status: 404 });
  if (term.kind === "sim") return NextResponse.json({ error: "Simulated schools take readings from the keeper only." }, { status: 400 });
  if (term.state.ended) return NextResponse.json({ error: "This term has ended." }, { status: 400 });

  const testIp = ipOf(b.client);
  const ids = b.upUuid ? `${b.uuid}|${b.upUuid}` : b.uuid;
  const reading: ReadingInput = {
    termId: BigInt(b.termId),
    takenAt: BigInt(b.takenAt),
    downKbps: b.downKbps,
    upKbps: b.upKbps,
    rttMs: b.rttMs,
    testId: testIdOf(ids),
    clientHash: clientHashOf(b.salt, testIp),
  };
  const signer = await recoverTypedDataAddress({
    domain: DOMAIN,
    types: READING_TYPES,
    primaryType: "Reading",
    message: reading,
    signature: b.sig,
  }).catch(() => null);
  if (!signer || signer.toLowerCase() !== term.terms.probe.toLowerCase()) {
    return NextResponse.json({ error: "This reading was not signed by this school's probe key." }, { status: 403 });
  }

  let testNet;
  try {
    testNet = await networkOf(testIp);
  } catch (e) {
    return NextResponse.json({ error: "The network the test ran over could not be looked up. Try again in a minute." }, { status: 502 });
  }
  // The device that ran the test must also be the one sending it, from the same network.
  const devLocal = !ip || isPrivate(ip);
  if (!devLocal || process.env.NODE_ENV === "production") {
    try {
      const sender = await networkOf(ip);
      if (sender.asn !== testNet.asn) {
        return NextResponse.json(
          {
            error: `The test ran over ${shortHolder(testNet.holder)} (AS${testNet.asn}), but the reading was sent from another network (AS${sender.asn}). A reading has to come from the network it measured. A VPN, iCloud Private Relay or a campus proxy can split the two: turn it off for this page and run the test again.`,
          },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json({ error: "Your network could not be looked up to confirm the reading. Try again in a minute." }, { status: 502 });
    }
  }

  try {
    const tx = await recordReadings([reading], [b.sig], [testNet.asn], [ids]);
    bust();
    const t = term.terms;
    const pass =
      testNet.asn === t.asn && b.downKbps >= t.minDownKbps && b.upKbps >= t.minUpKbps && b.rttMs <= t.maxRttMs;
    return NextResponse.json({ tx, pass, asn: testNet.asn, holder: shortHolder(testNet.holder), day: Math.floor((b.takenAt - t.start) / t.dayLength) });
  } catch (e) {
    return NextResponse.json({ error: plainError(e) }, { status: 502 });
  }
}
