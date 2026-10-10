# Decisions

Build-window decisions and measured evidence, newest first. Network: Tempo Moderato testnet, viem 2.57.4.

## 2026-10-10 (Phase 0 spikes, real browser)

Driver:  (headless Chrome over CDP with a WebAuthn virtual authenticator) loads  (), which runs the flow with the library in . Dev server on port 3100.

- **S1 passkey root in a browser: PASS.**  then  gave a Tempo address; the faucet funded it (1,000,000.00 AlphaUSD). Tested with a virtual authenticator, not yet on a real phone.
- **S3 passkey signs the key authorization: PASS.** The passkey account authorized the relative's key (limit 10, one payee); on-chain read-back showed scoped, remaining 10000000, one payee.
- **S7 key persistence: PASS in desktop Chrome.** The WebCrypto key (non-extractable) was stored in IndexedDB and reloaded with the same key id. Not yet tested on iOS Safari or Android Chrome.
- **S4 sponsorship through the real /api/relay route: PASS after one fix.** First run failed with "insufficient funds ... have 0 want 426" although the validator returned true and the sponsor signed. Cause: the sponsor had no preferred fee token, so the broadcast charged a token it did not hold. Fix: . After the fix a 4 AlphaUSD payment left the budget at exactly 6000000, and both refusals fired through the same path. Also found: killing a stale dev server needs the PID (netstat/Get-NetTCPConnection), not pkill.
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
