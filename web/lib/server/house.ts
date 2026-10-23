import "server-only";
import {
  createWalletClient,
  fallback,
  http,
  keccak256,
  encodePacked,
  type Hex,
  type Account,
  BaseError,
  ContractFunctionRevertedError,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN, RPC_URLS, publicClient } from "../chain";

function key(name: string): Hex {
  const v = (process.env[name] || "").trim().replace(/^"|"$/g, "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`${name} is not set on the server.`);
  return v as Hex;
}

let _house: Account | undefined;
let _provider: Account | undefined;
let _funder: Account | undefined;
let _arbiter: Account | undefined;
/** The attester: records readings, settles days, relays closures, owns the test dollar, pays visitors' gas. */
export const houseAccount = () => (_house ??= privateKeyToAccount(key("HOUSE_KEY")));
export const providerAccount = () => (_provider ??= privateKeyToAccount(key("PROVIDER_KEY")));
/** Opens demo terms, challenges suspicious days, ends terms after repeated outages. */
export const funderAccount = () => (_funder ??= privateKeyToAccount(key("FUNDER_KEY")));
/** Decides challenges. A separate key: the contract refuses a term where one key holds two roles. */
export const arbiterAccount = () => (_arbiter ??= privateKeyToAccount(key("ARBITER_KEY")));

/** Probe keys for the simulated schools, derived from the house key so nothing else needs storing. */
export function simProbeKey(index: number): Hex {
  return keccak256(encodePacked(["bytes32", "string", "uint256"], [key("HOUSE_KEY"), "rollcall-sim-probe", BigInt(index)]));
}
export const realProbeAddress = () => (process.env.REAL_PROBE_ADDRESS || "").trim().toLowerCase();

const transport = fallback(RPC_URLS.map((u) => http(u, { timeout: 15_000, retryCount: 1 })));
export const walletFor = (account: Account) => createWalletClient({ account, chain: CHAIN, transport });

/** One plain sentence for any revert or RPC failure. */
export function plainError(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName;
    const args = revert?.data?.args;
    const map: Record<string, string> = {
      NotAttester: "Only the attester can record readings.",
      BadSignature: "The reading was not signed by this school's probe key.",
      OutsideTerm: "That time is outside the term's school days.",
      FromTheFuture: "The reading is dated in the future.",
      TooLate: "That school day has closed; its readings can no longer arrive.",
      TestAlreadyUsed: "This M-Lab test has already been counted.",
      DayFull: "This school day already has the most readings allowed.",
      NotSettleable: "No school day is ready to settle yet.",
      AlreadySettled: "That day has already been settled.",
      TermIsOver: "This term has ended.",
      NotAccepted: "The provider has not accepted this term yet.",
      ChallengeClosed: "The challenge window for that day has closed.",
      NotEnoughStrikes: "The provider has not missed enough days in a row to end the term.",
      SettleFirst: "A finished day still has to settle before the term can end.",
      DayNotOver: "Only a finished day can be challenged.",
      DayHasReadings: "This day already has a reading, so it can no longer be marked closed.",
      AlreadyClosed: "This day is already marked closed.",
    };
    if (name && map[name]) return map[name];
    if (name === "BadTerms") return `The terms were refused: ${String(args?.[0] ?? "invalid")}.`;
    if (/insufficient funds/i.test(e.message)) return "The house wallet is out of test ETH for gas. It needs a top-up.";
    if (/nonce/i.test(e.message)) return "Another transaction from the house wallet was in flight. Try again in a few seconds.";
    return e.shortMessage || "The transaction failed.";
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

// Serialise sends per key inside one server instance; across instances, retry on nonce races.
const queues = new Map<string, Promise<unknown>>();
export async function send<T>(account: Account, fn: (nonce: number) => Promise<T>): Promise<T> {
  const prev = queues.get(account.address) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(async () => {
    let lastErr: unknown;
    for (let i = 0; i < 4; i++) {
      const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
      try {
        return await fn(nonce);
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (!/nonce|replacement|already known/i.test(msg)) throw e;
        await new Promise((r) => setTimeout(r, 600 + i * 700));
      }
    }
    throw lastErr;
  });
  queues.set(account.address, run);
  return run as Promise<T>;
}
