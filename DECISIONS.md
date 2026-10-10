# Decisions

Build-window decisions and measured evidence, newest first. Network: Tempo Moderato testnet, viem 2.57.4.

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
