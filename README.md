# Upkeep

**Don't send money home. Send a key.**

Upkeep lets a person abroad give a parent at home a spending key instead of a transfer. The key carries a limit that
renews on a schedule and a list of people it may pay. The parent pays when she needs to. The Tempo network refuses
everything outside the limit and the list, so the rule is enforced by the chain and not by the app.

Built for the Colosseum Crypto World's Fair, Tempo track. Runs on the Tempo Moderato testnet.

- **Live app:** `[LIVE_URL]`
- **Demo video:** `[VIDEO_URL]`
- **Source:** https://github.com/JUICEWRLD998/upkeep

---

## The problem

Families abroad support relatives at home every month: school fees, rent, a clinic bill. Today that means one of three
things:

1. Send the whole amount and trust it is spent as intended.
2. Pay each bill personally, which makes the sender a full-time payment desk.
3. Hand over a card with no real limits.

Remittance rails fix the speed and the fee. None of them fix the control. The sender has to choose between trust and
effort.

## The idea

The sender keeps the dollars in their own Tempo account and issues a **key** to the relative. The key is an Access Key
on Tempo's Account Keychain, with two on-chain constraints:

| Constraint | What it does |
|---|---|
| **Spending limit with a period** | The key can spend up to a set amount per week or month. The budget renews on its own. |
| **Allowed calls** | The key can call one token transfer function, and only to the payees the sender listed. |

A payment outside either constraint is rejected by the network with its own error. Nothing in Upkeep's server decides
that. Three refusals are shown in the product exactly as the network returns them:

| Network answer | Meaning |
|---|---|
| `SpendingLimitExceeded` | More than the key's limit for this period. |
| `CallNotAllowed` | A payee that is not on the list. |
| `KeyAlreadyRevoked` | Any attempt after the sender turned the key off. |

## How it works

```
  Sender (abroad)                                     Relative (at home)
  ---------------                                     ------------------
  1. Creates a passkey account, funds it
  2. Makes an invite link  ------------------------>  3. Opens the link. Her phone creates a key
                                                         and never exports it. She returns only
  5. Reviews and approves with the passkey  <-------     its public address.
     (limit, period, payees)
                                                      6. Pays a listed payee. Sponsored fee,
  7. Live feed shows each payment and refusal            so she needs no gas balance.
  8. Can revoke the key at any time                   9. Anything outside the rules is refused
                                                         by the network.
```

1. **Sender account.** A passkey (WebAuthn) is the root of the sender's Tempo account. There is no seed phrase.
2. **Invite.** The sender names the relative and shares a link. Nothing is spent and no secret is in the link.
3. **Relative's key.** The key is a non-extractable WebCrypto P-256 key stored in the relative's browser (IndexedDB).
   It is created on her device and never leaves it. Only the public address travels back.
4. **Approval.** The sender sets the limit, the period and the payee list. The passkey signs one key authorization on-chain.
5. **Payments.** The relative picks a payee and an amount. The transaction is signed with her key. A fee-paying relay
   sponsors the gas so she does not need a second balance.
6. **Control.** The sender's feed reads payments and refusals from the chain. Revoking the key is one action, and the
   relative's phone is told.

### Payout desk

Payees are people and institutions in Nigeria (for example a school). The **payout desk** registers a payee, derives a
dedicated deposit address for it with Tempo's virtual addresses, and lists incoming dollar payments with the naira
amount to be paid out at the current rate. A payment to a virtual address forwards to the desk's master address, and
the ledger reads those forwarding transfers from the chain.

## What is real and what is not

| Status | Item |
|---|---|
| **LIVE** | Dollars (AlphaUSD) on Tempo Moderato. Passkey sender account. The relative's on-device key. Spending limit, period renewal, payee allow-list, revocation. The three chain refusals. Fee sponsorship through the relay. The live feed. Payee registry and the desk ledger. |
| **SIMULATED** | The naira credit to a Nigerian bank account. The desk shows the payout instruction. No bank is called. |
| **NOT LIVE** | Mainnet, card issuing, identity checks (KYC). |
| **Test funds** | All dollars come from the public testnet faucet. The desk runs on a stand-in master address whose private key is discarded, so forwarded testnet dollars are not spendable by anyone. |

These labels also appear in the product. Every figure on screen (balance, remaining budget, period end, payments,
refusals) is read from the network at render time. There is no seeded or fixture data.

## Try it in two minutes

Use two browser profiles, or one normal window and one private window. One is the sender, the other is the relative.

1. **Window A (sender):** open the app, choose *Create my account*, create the passkey, press the faucet button.
2. **Window A:** enter the relative's name and create the invite link. Copy it.
3. **Window B (relative):** open the link. The page creates the key and shows a waiting state.
4. **Window A:** open the approval link from the invite panel. Set a limit, choose *Every 2 minutes* to watch a
   renewal (or *Every month*), add a payee, and approve with the passkey.
5. **Window B:** the budget appears, read from the chain. Pay a listed payee. The budget drops by exactly that amount.
6. **Window B:** try an unlisted address, then an amount above the limit. Both are refused with the network's own error.
7. **Window A:** the feed shows the payment and the refusals. Turn the key off. Window B's next attempt returns
   `KeyAlreadyRevoked`.
8. Open `/desk` to see payees and the simulated naira instruction for each dollar payment.

Every payment links to the Tempo explorer.

## Architecture

| Layer | Choice |
|---|---|
| App | Next.js (App Router), React, TypeScript, CSS Modules |
| Chain | Tempo Moderato testnet via `viem` 2.57.4 (`viem/tempo`) |
| Account | WebAuthn passkey root account. Access Key with spending limit and allowed calls on the Account Keychain |
| Relative's key | WebCrypto P-256, non-extractable, stored in IndexedDB |
| Fees | `/api/relay` fee payer. Sponsors exactly one call type (see below) |
| Payees | Neon Postgres registry (id, sender, label, bank, account name, last four digits) |
| Deposit addresses | Tempo virtual addresses, derived from the payee's row id and never stored |
| Motion | `motion` |

**Source map**

```
app/            pages and API routes (send, join, approve, home, desk, api/relay, api/desk)
components/     shared UI (Money, Slip, Stamp, forms)
lib/upkeep/     chain access, keys, payments, feed, links, relay policy, desk, rate
scripts/        end-to-end drivers, abuse tests, UI verification
tests/          unit, fuzz and live-network tests
```

**What the server stores.** Only the payee registry, and only the last four digits of a bank account. Balances,
limits, payments and payee lists are never stored. They are read from the network.

**What the relay will pay for.** One AlphaUSD `transfer` on Moderato with exact calldata length, no value and a gas
limit of at most 400,000. Everything else (other tokens, `approve`, batches, padded calldata, oversized gas) is
refused and falls back to sender-paid. The relay also limits requests per account and for the whole service, and
refuses request bodies over 64 KB.

## Verification

All checks run against a production build, the real Moderato network and a real database.

| Check | Result |
|---|---|
| `npm run verify` (typecheck, lint, unit tests, build) | passes |
| `npm run e2e` two clean browsers: account, invite, key, approval, payment, both refusals, revoke | 20 of 20 steps, three runs in a row |
| `npm run e2e:desk` payee, virtual address, payment, desk ledger | 15 of 15 steps |
| `npm run e2e:hardening` double-tap, reload, lost phone, relay down, live renewal | 25 of 25 steps |
| `npm run abuse` relay and desk abuse cases | 24 of 24 checks |
| Fuzz: 4,000 random invite strings and 2,000 one-character mutations of a valid invite | only the expected `LinkError` is ever thrown |
| UI: 56 page-width samples from 320 to 1920 px | no overflow; axe-core reports 0 violations |

**A bug the hardening run found.** Three rapid taps on *Pay* made two real payments, because the disabled state only
updates after a render. An in-flight flag now blocks the second tap immediately. Three rapid clicks now make one
payment. The details of this and every other decision are in [`DECISIONS.md`](./DECISIONS.md).

**Known limits.** Testing on real iOS Safari and Android Chrome is still to do; the passkey and key persistence were
tested in desktop Chrome with a virtual authenticator. The test period (2 minutes) exists so a renewal can be watched.

## Run locally

Requires Node 24 or later.

```bash
npm install
cp .env.example .env.local     # fill in the values below
npm run dev                    # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL` | Optional. Default to the public Moderato RPC and explorer. |
| `FEE_PAYER_PRIVATE_KEY` | Testnet account that sponsors fees. Fund it from the faucet. |
| `DATABASE_URL` | Neon Postgres connection string for the payee registry. |
| `DESK_MASTER_ID`, `DESK_MASTER_ADDRESS` | Virtual-address master for the payout desk. `scripts/setup-server-keys.mjs` writes these. |

Never commit `.env` files. Use testnet keys only.

```bash
npm run verify        # typecheck, lint, unit tests, production build
npm run e2e           # two-browser end-to-end flow (needs a running server)
npm run test:live     # live-network tests
```

Stop the dev server before `npm run verify`, because the build overwrites `.next`.

## Documents

- [`DECISIONS.md`](./DECISIONS.md): decisions and measured evidence, newest first.

---

Mustapha Fadhlullah, independent security researcher.
