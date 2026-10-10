# Decisions

Build-window decisions and measured evidence, newest first. Network: Tempo Moderato testnet, viem 2.57.4.

## 2026-10-10 (Phase 3, payees and the payout desk)

- **Registry in Neon, chain for everything else.** One table, `payees` (id, sender, label, bank, account name, last 4 digits). Balances, limits, payments and payee lists are never stored; they come from the network. Only the last four digits of a bank account are kept, because the naira credit is simulated and a full number would be personal data with no use. Tested against the real database by `tests/live.db.test.ts`, including the 20-payees-per-sender cap.
- **Deposit addresses are derived, not stored:** `VirtualAddress.from({ masterId, userTag })` with the userTag set to the payee's row id as 6 bytes. A payment to that address forwards to the desk master, and `/api/desk/ledger` finds it from the forwarding transfers.
- **The RPC rejects log queries over 100,000 blocks** ("query exceeds max block range 100000"). Found by `tests/live.desk.test.ts` the first time it ran. All log reads now go through `chunkedLogs` (90,000-block pieces). The sender feed had the same latent bug for accounts older than 100,000 blocks. Measured block rate: about 5,900 blocks per hour, so the desk's 200,000-block window is about 34 hours; the page says so.
- **Naira rate:** `open.er-api.com` (free, no key), cached 10 minutes, rejected if outside 100 to 20,000 NGN per USD. If the feed is down the desk shows "rate unavailable" and no naira figures. It never uses a made-up number. The feed updates once a day, so the page prints the update time.
- **Salt mining is slower than my Phase 1 note implied.** The earlier 60-second find was luck. Measured rate: about 2.7 million salts per second with 4 workers, so one 2^32 range takes about 26 minutes and a range has about a 63% chance of a hit.
- **Lost the first test master.** The master from the first virtual-address spike (0xFf362180...) was generated inside a throwaway script and its private key was never saved; its registration is real, so it is only useful for read tests. The server master key is now saved in `.env.local` before mining starts.

## 2026-10-10 (Phase 2, thin path in two browsers)

Exit check: `scripts/e2e-two-browsers.mjs` drives two clean headless Chrome profiles (A = sender with a virtual passkey, B = relative) through the real pages against Moderato. Result after the fixes below: 20/20 steps, three runs in a row, 34-35 s each. Steps: create passkey account, faucet, invite, key made on B's browser, B sees "waiting", A approves with the passkey, B sees $10.00 from the chain and the labelled payee, pays $4 (budget exactly $6.00), chain refuses a stranger (CallNotAllowed) and an over-limit payment (SpendingLimitExceeded), A's feed shows "Mummy paid $4.00", A turns the key off, B is told, B's next attempt is refused (KeyAlreadyRevoked).

- **Unapproved keys do not throw.** Measured with `scripts/probe-states.mjs`: for a key the sender has not approved, `getMetadata` returns the zero address, `spendPolicy: unlimited`, `isRevoked: false`, `getRemainingLimit` returns 0 and `getAllowedCalls` returns `[true, []]`. A revoked key returns `isRevoked: true`, remaining 0 and no calls. `readKeyState` now returns `status: 'pending' | 'active' | 'revoked'`; before this the relative's page would have shown $0.00 instead of "waiting".
- **Simulating a payment with a revoked key is slow:** about 5 s directly and about 25 s through the relay (`scripts/probe-revoked-relay.mjs`), against about 250 ms for a stranger or over-limit refusal. A relative would stare at a spinner, and the slow path sometimes ended in "transaction expired". Chosen: `pay()` takes an optional precheck that reads the key's on-chain record first and refuses revoked or expired keys at once, with raw text saying it came from the key record. Rejected: waiting for the network's own answer. The stranger and over-limit refusals stay real attempts.
- **"Transaction expired" is classified `TransactionExpired`**, copy says nothing was paid, and `pay()` retries up to 3 times because an expired transaction never moved money. Seen once as "current block timestamp 1791662880 >= validBefore 1791662879"; local clock skew against the chain measured 0-1 s, so the cause is latency, not skew.
- **Lint:** the `react-hooks/set-state-in-effect` rule flagged mount-time reads of browser storage. The config-protection hook blocks weakening `eslint.config.mjs`, so the source was changed instead: those loads now run in a `setTimeout(0)` callback.
- Stale dev server on port 3100 still bit once; fixed with Get-NetTCPConnection and Stop-Process.

## 2026-10-10 (Phase 0 spikes, real browser)

Driver: `scripts/driver-spike.mjs` (headless Chrome over CDP with a WebAuthn virtual authenticator) loads `/spike` (`app/spike/page.tsx`), which runs the flow with the library in `lib/upkeep`. Dev server on port 3100.

- **S1 passkey root in a browser: PASS.** `WebAuthnP256.createCredential` then `Account.fromWebAuthnP256` gave a Tempo address; the faucet funded it (1,000,000.00 AlphaUSD). Tested with a virtual authenticator, not yet on a real phone.
- **S3 passkey signs the key authorization: PASS.** The passkey account authorized the relative's key (limit 10, one payee); on-chain read-back showed scoped, remaining 10000000, one payee.
- **S7 key persistence: PASS in desktop Chrome.** The WebCrypto key (non-extractable) was stored in IndexedDB and reloaded with the same key id. Not yet tested on iOS Safari or Android Chrome.
- **S4 sponsorship through the real /api/relay route: PASS after one fix.** First run failed with "insufficient funds ... have 0 want 426" although the validator returned true and the sponsor signed. Cause: the sponsor had no preferred fee token, so the broadcast charged a token it did not hold. Fix: `Relay.feePayer({ account, feeToken: TOKEN, validate })`. After the fix a 4 AlphaUSD payment left the budget at exactly 6000000, and both refusals fired through the same path. Also found: killing a stale dev server needs the PID (netstat/Get-NetTCPConnection), not pkill.
- **S2 relative's key as a passkey: NOT RUN.** WebCrypto P256 is the chosen path; copy will say the key is on her phone and never claims a fingerprint.
- **S8 free store: NOT RUN yet.**

## 2026-10-10 (Phase 0 spikes, Node)

- **S4 fee sponsorship: PASS.** A parent transfer of 4 AlphaUSD sent with `feePayer: true` through a local relay
  (`Transport.withRelay(http(), { plugins: [Relay.feePayer({ account })] })`) left the key's remaining limit at exactly
  6000000 of 10000000. The receipt shows the sponsor as `feePayer`. Without sponsorship the same spend left 5999800
  (earlier spike). Tx `0x8bef83df4e72cc61257b97faf139e8629b22b53bf66e7295ca68a323c872dba3`. Script: `scripts/spike-s4.mjs`.
  Rejected: paying fees in a second stablecoin (more setup, parent would need a second balance).
- **S5 read-back: PASS with a correction.** viem has no `getAllowedCalls` action. `getMetadata` returns only
  address, keyType, expiry, spendPolicy, isRevoked. The payee list is read from the keychain precompile with
  `readContract({ address: Addresses.accountKeychain, abi: Abis.accountKeychain, functionName: 'getAllowedCalls',
  args: [account, keyId] })` -> `[isScoped, [{ target, selectorRules: [{ selector, recipients }] }]]`.
  `getRemainingLimit` returns `{ remaining, periodEnd }`. `Actions.token.getBalance` returns
  `{ amount, decimals, formatted }`, not a bigint. Script: `scripts/spike-s5.mjs`.
- **S6 virtual payee: PASS** (see IMPLEMENTATION.md section 1). Salt mining can return `undefined`; handle it.
- Earlier in the session (scratchpad spikes): WebCrypto P256 key as access key works; CallNotAllowed,
  SpendingLimitExceeded, KeyAlreadyRevoked fire; the period renews; fees paid in the capped token count against it.
