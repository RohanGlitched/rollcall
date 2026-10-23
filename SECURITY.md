# Security model

Roll Call moves money on measurements. This page lists who is trusted with what, and how each attack we could think of is stopped or left to the funder.

## Keys and what each can do

| Key | Held by | Can | Cannot |
|---|---|---|---|
| Probe | the school’s device | sign readings or offline reports; close a day before any test that day | choose the network a reading is credited to; pay anyone; close a day that has a reading |
| Attester | an independent organisation, named per term | record probe-signed readings with the network they ran over | alter any signed field; reuse an M-Lab test id; record outside a term or after the late window; record for a term it is not named in |
| Funder | whoever paid for the term | open terms; challenge a finished day (staking a deposit); end a term after `strikeLimit` absent days in a row | take back a settled day; void a day without the arbiter; end a term while an earned day is unsettled |
| Provider | the internet provider | accept a term and post the bond | be paid for a day without passing readings |
| Arbiter | an auditor or regulator | uphold or reject a challenge (silence lets it lapse) | move money any other way |
| Anyone | — | settle finished days in order | anything else |

## Attacks

| Attack | What stops it | Test |
|---|---|---|
| Attester inflates a slow reading | the probe’s EIP-712 signature covers every number | `test_tampered_reading_is_rejected` |
| Someone else’s key signs readings | signature must recover to the term’s probe | `test_reading_signed_by_another_key_is_rejected` |
| One good test counted many times | `testUsed[keccak(testId)]` is global and permanent | `test_one_test_cannot_be_counted_twice` |
| A reading claims an M-Lab id it did not sign | the full id’s hash must equal the signed `testId` | `test_test_id_must_match_the_mlab_uuid` |
| Teacher tests over a phone hotspot, or a provider’s own office line | attester records the network of the address M-Lab saw; the contract only passes the contracted ASN | `test_reading_over_another_network_does_not_count` |
| A line that works for half an hour retries until it has enough passes | the day is split into parts and only the first pass in each counts | `test_retrying_inside_one_slot_cannot_earn_a_full_day` |
| One key plays two roles (e.g. funder as arbiter, provider as attester) | `open` refuses any term where a key repeats | `test_no_key_may_hold_two_roles` |
| Reading posted from a different network than it measured | the attester refuses when the sender’s network ≠ the test’s network | `web/app/api/reading/route.ts` |
| Backfilling a dead day after the fact | readings must arrive before `dayEnd + lateWindow`, never at a moment the day can settle | `test_late_reading_is_rejected_at_the_settle_boundary` |
| Pre-dating or future-dating readings | `takenAt` within the term and at most 60 seconds ahead | `test_future_reading_is_rejected`, `test_reading_before_start_is_rejected` |
| Flooding a day with failing readings so a later pass cannot land | at most 24 failing readings, but a pass the day still needs is always accepted | `test_cap_stops_failing_floods_but_never_a_needed_pass` |
| School turns a failed day into a “closed” one, or erases a pass | closures only before the day has any reading, and never twice | `test_a_day_with_readings_cannot_be_closed`, `test_a_closure_cannot_be_replayed` |
| A power cut is blamed on the provider | a dead device reports nothing: Silent, refunded, no strike; a dead line with a live probe signs offline reports: Absent | `test_silent_day_is_refunded_without_a_strike`, `test_offline_report_makes_the_day_absent_not_silent` |
| A funder freezes payment with a challenge the arbiter never decides | challenges cost a deposit and lapse after one more challenge window | `test_a_silent_arbiter_lets_the_challenge_lapse` |
| Funder refuses to pay | money is locked at open; settlement is permissionless; challenges need the arbiter | `test_present_day_pays_provider_in_full`, `test_rejected_challenge_pays_as_measured` |
| Provider walks away | absent days accumulate strikes; the funder ends the term and takes unserved days plus a slice of the bond, but never a day with a pass | `test_terminate_after_strike_limit_returns_unserved_days`, `test_terminate_waits_until_earned_days_are_settled` |
| Money created or stranded by an odd sequence | conservation fuzz: 500 random terms with random readings, networks, closures and challenges | `testFuzz_money_is_conserved` |

## Left to the funder, and to the provider

- **A school that colludes with the funder** can withhold passing tests and send offline reports instead, turning working days into absent ones. The provider’s own monitoring and M-Lab’s archive (which would show no tests from the school while its line carried traffic) are its evidence; in this design the provider takes that to the arbiter or regulator off chain. A provider-side challenge is a natural next rule.

- **A probe edits speeds before signing.** Speeds come from M-Lab’s server-side counters, but the probe relays them. M-Lab’s public archive holds the server’s own record for every test id; a funder who finds a mismatch challenges the day. The demo’s “Barmer” school shows this path end to end.
- **School and provider collude** by running tests from somewhere else on the same network. The network check passes. Site visits, the archive’s server location and the bond are the funder’s tools; a real deployment would add attesters who check location.
- **A single attester per term.** The design calls for a quorum, each independently looking up the network.
- **IPv4 address hashes.** The client address is hashed with a salt the probe keeps, so the hash on chain cannot be reversed by trying every address; M-Lab’s own archive still lists the address for each test id, which visitors agree to before testing.
- **Probe keys in browsers.** Visitor terms keep the probe key in browser storage. A school device should keep it in hardware.

## Demo-only trust

Four separate server keys play funder, attester, arbiter and provider for demo terms, because the contract refuses one key in two roles; they are environment variables, and nothing on the client can spend them. The attester also pays visitors’ gas. The test dollar has no value; its owner (the house) mints it for demo terms.
