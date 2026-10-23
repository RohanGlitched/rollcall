// Gas used by this deployment's own transactions on Base Sepolia (scripts/measure-gas.mjs, Oct 23 2026).
export const GAS_ROWS = [
  { label: "Open a term (funder locks the money)", gas: 237_850, tx: "0x17690db9986fde9591f2b94ec602927defd626f7928d0d757dfede3483374acc" },
  { label: "Accept a term (provider posts the bond)", gas: 74_602, tx: "0x7be6ccc518fba77fb694990fbb598b370f4bf524d657d96ec7936f6d33732195" },
  { label: "Record one reading", gas: 93_651, tx: "0x541ce0ad54fc9eb64174145636fc8e29083e06e0cc856497409a887bc598f730" },
  { label: "Settle one school day", gas: 88_756, tx: "0x063a2ebe2676986672e4a9ff530ff075caa831e1b36a99536ba29587ddc83fd6" },
];
// A day's four readings in one batch: the first costs a full call, each further one about 55k.
export const YEAR_GAS = 200 * (93_651 + 3 * 55_000 + 88_756) + 237_850 + 74_602;
