import { ImageResponse } from "next/og";

export const alt = "Roll Call: school internet, paid by the day it works";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FIBRES = ["#3d8bff", "#ff8a2a", "#2fcb74", "#c08a55", "#9fb2c2", "#a585ff"];
// each strand: L = lit day, C = cut, S = sleeve, P = part lit
const ROWS = ["LLLLLLLLLPLLLLLL", "LLLLLLLCCCCC....", "LLLLLSSLLLLCCLLP", "PLPPLLPPCPLPPLPP", "LLLLDLLLLLLLLDDL", "LLLLLLLLLVLLLLLL"];

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0c1a22", padding: "64px 72px", color: "#eaf2f0", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 700 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, background: "#12252f", padding: 9, borderRadius: 10 }}>
            {FIBRES.map((c) => (
              <div key={c} style={{ width: 34, height: 4, borderRadius: 4, background: c }} />
            ))}
          </div>
          Roll Call
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, marginTop: 40, maxWidth: 900 }}>
          School internet, paid by the day it works.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: "auto" }}>
          {ROWS.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              {r.split("").map((k, d) => {
                const c = FIBRES[i];
                const base = { width: 60, height: 8, borderRadius: 1 };
                if (k === "L") return <div key={d} style={{ ...base, background: c, boxShadow: `0 0 14px ${c}` }} />;
                if (k === "P") return <div key={d} style={{ ...base, background: `linear-gradient(90deg, ${c} 55%, ${c}33 55%)` }} />;
                if (k === "S") return <div key={d} style={{ ...base, height: 14, marginTop: -3, background: "#5d6a66", borderRadius: 6 }} />;
                if (k === "C") return <div key={d} style={{ ...base, background: `linear-gradient(90deg, ${c}33 30%, transparent 30%, transparent 70%, ${c}33 70%)` }} />;
                if (k === "V") return <div key={d} style={{ ...base, background: "#ff5a4f" }} />;
                if (k === "D") return <div key={d} style={{ ...base, background: `${c}33` }} />;
                return <div key={d} style={{ ...base, height: 2, marginTop: 3, background: `${c}44` }} />;
              })}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
