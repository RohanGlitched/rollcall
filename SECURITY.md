# Security model

Roll Call moves money on measurements. This page lists who is trusted with what, and how each attack we could think of is stopped or left to the funder.

## Keys and what each can do

| Key | Held by | Can | Cannot |
|---|---|---|---|
| Probe | the school’s device | sign readings; close a day before it ends | choose the network a reading is credited to; pay anyone |
| Attester | an independent organisation (one house key in this demo) | record probe-signed readings with the network they ran over | alter any signed field; reuse an M-Lab test id; record outside a term or after the late window |
| Funder | whoever paid for the term | open terms; challenge a day before it settles; end a term after `strikeLimit` missed days in a row | take back a settled day; void a day without the arbiter |
| Provider | the internet provider | accept a term and post the bond | be paid for a day without passing readings |
| Arbiter | an auditor or regulator | uphold or reject a challenge | move money any other way |
| Anyone | — | settle finished days in order | anything else |

## Attacks

| Attack | What stops it | Test |
|---|---|---|
| Attester inflates a slow reading | the probe’s EIP-712 signature covers every number | `test_tampered_reading_is_rejected` |
| Someone else’s key signs readings | signature must recover to the term’s probe | `test_reading_signed_by_another_key_is_rejected` |
| One good test counted many times | `testUsed[keccak(testId)]` is global and permanent | `test_one_test_cannot_be_counted_twice` |
| A reading claims an M-Lab id it did not sign | the full id’s hash must equal the signed `testId` | `test_test_id_must_match_the_mlab_uuid` |
| Teacher tests over a phone hotspot, or a provider’s own office line | attester records the network of the address M-Lab saw; the contract only passes the contracted ASN | `test_reading_over_another_network_does_not_count` |
| Reading posted from a different network than it measured | the attester refuses when the sender’s network ≠ the test’s network | `web/app/api/reading/route.ts` |
| Backfilling a dead day after the fact | readings must arrive before `dayEnd + lateWindow` | `test_late_reading_is_rejected` |
| Pre-dating or future-dating readings | `takenAt` within the term and at most 5 minutes ahead | `test_future_reading_is_rejected`, `test_reading_before_start_is_rejected` |
| Flooding a day with readings to drown failures | at most 24 readings per day | `test_day_caps_readings` |
| School turns a failed day into a “closed” one afterwards | closures must arrive before the day ends | `test_day_cannot_be_closed_after_it_ends` |
| Funder refuses to pay | money is locked at open; settlement is permissionless; challenges need the arbiter | `test_present_day_pays_provider_in_full`, `test_rejected_challenge_pays_as_measured` |
| Provider walks away | strikes accumulate; funder ends the term and takes unserved days plus a slice of the bond | `test_terminate_after_strike_limit_returns_unserved_days` |
| Money created or stranded by an odd sequence | conservation fuzz: 500 random terms with random readings, networks, closures and challenges | `testFuzz_money_is_conserved` |

## Left to the funder

- **A probe edits speeds before signing.** Speeds come from M-Lab’s server-side counters, but the probe relays them. M-Lab’s public archive holds the server’s own record for every test id; a funder who finds a mismatch challenges the day. The demo’s “Barmer” school shows this path end to end.
- **School and provider collude** by running tests from somewhere else on the same network. The network check passes. Site visits, the archive’s server location and the bond are the funder’s tools; a real deployment would add attesters who check location.
- **A single attester.** One key plays the attester here. The design calls for a quorum, each independently looking up the network.
- **Probe keys in browsers.** Visitor terms keep the probe key in browser storage. A school device should keep it in hardware.

## Demo-only trust

The house key funds every demo term, acts as attester and arbiter, and pays gas for visitors. The provider key accepts terms. Both are server environment variables; nothing on the client can spend them. The test dollar has no value; its owner (the house) mints it for demo terms.
