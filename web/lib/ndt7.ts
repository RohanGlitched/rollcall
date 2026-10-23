// A small ndt7 client for the browser (M-Lab's speed test protocol).
// Download and upload each run for up to 10 seconds against the nearest M-Lab server.
// Speeds come from the server's own TCP counters (TCPInfo), the same numbers M-Lab
// keeps in its public archive, so a reading can later be checked against that archive.

export type Ndt7Progress = {
  phase: "locate" | "download" | "upload" | "done";
  mbps: number;
  elapsed: number; // seconds into the current phase
};

export type Ndt7Result = {
  downKbps: number;
  upKbps: number;
  rttMs: number; // minimum round trip seen by the server
  uuid: string; // M-Lab test id (download)
  upUuid?: string; // M-Lab test id (upload)
  client: string; // ip:port the server saw
  clientIp: string;
  server: string;
  machine: string; // M-Lab host name
  city: string;
  country: string;
  finishedAt: number; // unix seconds
};

const LOCATE = "https://locate.measurementlab.net/v2/nearest/ndt/ndt7?client_name=rollcall-probe&client_version=1";
const PROTOCOL = "net.measurementlab.ndt.v7";
const PHASE_SECONDS = 10;

type ServerMeasurement = {
  ConnectionInfo?: { Client: string; Server: string; UUID: string };
  TCPInfo?: { BytesAcked?: number; BytesReceived?: number; ElapsedTime?: number; MinRTT?: number };
  BBRInfo?: { MinRTT?: number };
};

export function ipOf(client: string): string {
  // "[2405:201::1]:51234" or "203.0.113.4:51234"
  if (client.startsWith("[")) return client.slice(1, client.indexOf("]"));
  const i = client.lastIndexOf(":");
  return i > 0 ? client.slice(0, i) : client;
}

async function locate(): Promise<{ machine: string; city: string; country: string; down: string; up: string }> {
  const r = await fetch(LOCATE, { cache: "no-store" });
  if (!r.ok) throw new Error(`M-Lab could not find a test server (HTTP ${r.status}). Try again in a minute.`);
  const j = await r.json();
  const s = j.results?.[0];
  if (!s) throw new Error("M-Lab returned no test server. Try again in a minute.");
  return {
    machine: s.machine,
    city: s.location?.city ?? "",
    country: s.location?.country ?? "",
    down: s.urls["wss:///ndt/v7/download"],
    up: s.urls["wss:///ndt/v7/upload"],
  };
}

function download(url: string, onProgress: (p: Ndt7Progress) => void) {
  return new Promise<{ kbps: number; rttMs: number; info?: ServerMeasurement["ConnectionInfo"] }>((resolve, reject) => {
    const ws = new WebSocket(url, PROTOCOL);
    ws.binaryType = "arraybuffer";
    const t0 = performance.now();
    let bytes = 0;
    let last: ServerMeasurement["TCPInfo"];
    let minRtt = Infinity;
    let info: ServerMeasurement["ConnectionInfo"];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      const secs = (performance.now() - t0) / 1000;
      // Prefer the server's count of acknowledged bytes; fall back to what the page received.
      const serverKbps =
        last?.BytesAcked && last?.ElapsedTime ? (last.BytesAcked * 8) / (last.ElapsedTime / 1e6) / 1000 : 0;
      const clientKbps = secs > 0 ? (bytes * 8) / secs / 1000 : 0;
      resolve({ kbps: Math.round(serverKbps || clientKbps), rttMs: Number.isFinite(minRtt) ? Math.round(minRtt) : 0, info });
    };
    const timer = setTimeout(finish, (PHASE_SECONDS + 3) * 1000);
    ws.onmessage = (e) => {
      if (typeof e.data === "string") {
        const m = JSON.parse(e.data) as ServerMeasurement;
        if (m.ConnectionInfo) info = m.ConnectionInfo;
        if (m.TCPInfo) last = m.TCPInfo;
        const rtt = m.TCPInfo?.MinRTT ?? m.BBRInfo?.MinRTT;
        if (rtt) minRtt = Math.min(minRtt, rtt / 1000);
      } else {
        // browsers give an ArrayBuffer; some server runtimes give a Blob or nothing (the server's count is used then)
        const d = e.data as ArrayBuffer | Blob | null;
        bytes += d ? ("byteLength" in d ? d.byteLength : d.size) : 0;
      }
      const secs = (performance.now() - t0) / 1000;
      onProgress({ phase: "download", mbps: (bytes * 8) / Math.max(secs, 0.1) / 1e6, elapsed: secs });
    };
    ws.onclose = finish;
    ws.onerror = () => {
      if (!done && bytes === 0) {
        done = true;
        clearTimeout(timer);
        reject(new Error("The download test could not connect. A firewall or VPN may be blocking M-Lab."));
      } else finish();
    };
  });
}

function upload(url: string, onProgress: (p: Ndt7Progress) => void) {
  return new Promise<{ kbps: number; rttMs: number; uuid?: string }>((resolve, reject) => {
    const ws = new WebSocket(url, PROTOCOL);
    ws.binaryType = "arraybuffer";
    let t0 = 0;
    let sent = 0;
    let last: ServerMeasurement["TCPInfo"];
    let minRtt = Infinity;
    let uuid: string | undefined;
    let done = false;
    let chunk = new Uint8Array(1 << 13);
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      const secs = t0 ? (performance.now() - t0) / 1000 : 0;
      const serverKbps =
        last?.BytesReceived && last?.ElapsedTime ? (last.BytesReceived * 8) / (last.ElapsedTime / 1e6) / 1000 : 0;
      const clientKbps = secs > 0 ? ((sent - ws.bufferedAmount) * 8) / secs / 1000 : 0;
      resolve({ kbps: Math.round(serverKbps || clientKbps), rttMs: Number.isFinite(minRtt) ? Math.round(minRtt) : 0, uuid });
    };
    const timer = setTimeout(finish, (PHASE_SECONDS + 3) * 1000);
    const pump = () => {
      if (done || ws.readyState !== WebSocket.OPEN) return;
      const secs = (performance.now() - t0) / 1000;
      if (secs >= PHASE_SECONDS) return finish();
      // Browsers report bufferedAmount; some server runtimes always say 0, so also cap what one tick may queue
      // (8 messages per 25 ms tick, up to ~2.6 Gbit/s with 1 MiB messages) to keep the socket from flooding.
      for (let n = 0; ws.bufferedAmount < 7 * chunk.length && n < 8; n++) {
        ws.send(chunk);
        sent += chunk.length;
        // grow messages as the link proves fast, as the ndt7 spec suggests
        if (chunk.length < 1 << 20 && sent >= 16 * chunk.length) chunk = new Uint8Array(chunk.length * 2);
      }
      const acked = last?.BytesReceived ?? Math.max(0, sent - ws.bufferedAmount);
      onProgress({ phase: "upload", mbps: (acked * 8) / Math.max(secs, 0.1) / 1e6, elapsed: secs });
      setTimeout(pump, 25);
    };
    ws.onopen = () => {
      t0 = performance.now();
      pump();
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      const m = JSON.parse(e.data) as ServerMeasurement;
      if (m.ConnectionInfo?.UUID) uuid = m.ConnectionInfo.UUID;
      if (m.TCPInfo) last = m.TCPInfo;
      const rtt = m.TCPInfo?.MinRTT ?? m.BBRInfo?.MinRTT;
      if (rtt) minRtt = Math.min(minRtt, rtt / 1000);
    };
    ws.onclose = finish;
    ws.onerror = () => {
      if (!done && sent === 0) {
        done = true;
        clearTimeout(timer);
        reject(new Error("The upload test could not connect. A firewall or VPN may be blocking M-Lab."));
      } else finish();
    };
  });
}

export async function runNdt7(onProgress: (p: Ndt7Progress) => void): Promise<Ndt7Result> {
  onProgress({ phase: "locate", mbps: 0, elapsed: 0 });
  const srv = await locate();
  const d = await download(srv.down, onProgress);
  if (!d.info?.UUID) throw new Error("M-Lab did not return a test id, so this reading could not be audited. Run the test again.");
  const u = await upload(srv.up, onProgress);
  onProgress({ phase: "done", mbps: 0, elapsed: 0 });
  const rtts = [d.rttMs, u.rttMs].filter((x) => x > 0);
  return {
    downKbps: d.kbps,
    upKbps: u.kbps,
    rttMs: rtts.length ? Math.min(...rtts) : 0,
    uuid: d.info.UUID,
    upUuid: u.uuid,
    client: d.info.Client,
    clientIp: ipOf(d.info.Client),
    server: d.info.Server,
    machine: srv.machine,
    city: srv.city,
    country: srv.country,
    finishedAt: Math.floor(Date.now() / 1000),
  };
}
