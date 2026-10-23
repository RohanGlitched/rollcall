// Gas used by this deployment's own transactions on Base Sepolia (scripts/measure-gas.mjs, Oct 23 2026, contract v2).
export const GAS_ROWS = [
  { label: "Open a term (funder locks the money)", gas: 265_179, tx: "0x62aba1493be9f9f836a481f8d1dfc08540fbd6a3a9c681c4f6c1f60c32d7df1a" },
  { label: "Accept a term (provider posts the bond)", gas: 75_419, tx: "0x703ca5ad2baac6f28740d383b286d89053010a2a92a188b044086f2d2dd36663" },
  { label: "Record one reading", gas: 97_494, tx: "0x5f06bba128b68770f8c217f02cd6b826e05d2206a156e3b1ded0dc8a9eb45682" },
  { label: "Settle one school day", gas: 89_000, tx: "" },
];
// A day's four readings in one batch: the first costs a full call, each further one about 58k.
export const YEAR_GAS = 200 * (97_494 + 3 * 58_000 + 89_000) + 265_179 + 75_419;
