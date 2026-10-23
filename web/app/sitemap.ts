import type { MetadataRoute } from "next";

const BASE = "https://rollcall-schools.vercel.app";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/test", "/how", "/why", "/verify", "/terms"].map((p) => ({ url: `${BASE}${p}`, changeFrequency: "hourly" }));
}
