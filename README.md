# Odudu

**A policy-controlled treasury for AI-assisted business payments.**

Odudu separates financial agency from financial authority. An AI agent may prepare a payment proposal, but business-owned rules and human approvals determine whether it can proceed.

## Current implementation

- Managed Better Auth sign-up, sign-in and sign-out.
- Neon PostgreSQL storage for businesses, treasury policies, approved recipients, payment approvals, transactions and audit events.
- Server-side deterministic policy evaluation. The LLM does not get to change policy.
- Owner-managed payment limits, daily budgets, approval thresholds and spending categories.
- Owner-authorized destination registry. Live quotes must use the exact registered destination.
- Human approval queue for payments above the automatic threshold.
- Tidepool / NEAR Intents testnet quote, deposit submission and settlement status flow.
- Persisted transaction lifecycle and business-scoped audit history.
- CSV export of recorded transactions.

## Important security boundary

**TEE enforcement, isolated signing, wallet key custody and autonomous AI execution are not implemented yet.** Do not describe this prototype as TEE-secured or as a production-ready financial custodian.

The current settlement integration is restricted to Tidepool's testnet service. Never use real funds or mainnet. Odudu does not request or store wallet private keys. A live quote creates a testnet deposit address; it does not itself move funds.

The business owner must explicitly authorize every payee destination. The special recipient key `owner-refund` is used for the business's source-chain refund wallet. For the current NEAR testnet flow, register it with chain ID `near:testnet`.

## Stack

- Next.js 16 App Router, React and TypeScript
- Neon PostgreSQL and Managed Better Auth
- `@neondatabase/serverless`
- Zod validation and Vitest
- Vercel deployment
- Tidepool community testnet sandbox for NEAR Intents

## Environment

Copy `.env.example` to `.env.local` and fill in the Neon values from your project. Use the pooled PostgreSQL connection string for `DATABASE_URL` in Vercel and local development.

Required variables:

- `DATABASE_URL` — Neon pooled PostgreSQL connection string.
- `NEON_AUTH_BASE_URL` — Managed Better Auth URL for the branch.
- `NEON_AUTH_COOKIE_SECRET` — random secret of at least 32 characters.
- `NEAR_INTENTS_API_BASE_URL` — keep this at `https://www.usetidepool.tech` for the testnet integration.

`NEON_AUTH_JWKS_URL` is included for server-side token verification as the trusted execution boundary is developed.

These variables are configured in Vercel for production, preview and development. Do not commit `.env.local` or secrets.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm test
npm run lint
npm run build
```

## First-time setup

1. Open `/auth/sign-up` and create the business owner account.
2. Open `/policy` and set the business's spending limits and allowed categories.
3. Open `/recipients` and register the business refund wallet using recipient key `owner-refund`, chain ID `near:testnet`, and the owner's NEAR testnet address.
4. Add each payee as a separate recipient with a unique key, chain ID and exact destination address.
5. Evaluate payments from the treasury home page.
6. Payments above the approval threshold appear in `/approvals`. An owner must approve them before a live quote can be created.
7. Review settlement history at `/audit` and export transaction records as CSV.

## Policy defaults

A new business receives these initial defaults. The owner can change them from `/policy`.

| Rule | Default |
|---|---:|
| Maximum single payment | $1,000 |
| Daily budget | $2,500 |
| Human approval above | $300 |
| Allowed categories | Software, operations, payroll, marketing |

Daily spend is calculated from successful transactions recorded in the business ledger.

## Payment flow

```text
AI / user payment proposal
          |
          v
  Authenticated business
          |
          v
  Deterministic policy check
       /             \
   reject         approval needed?
                    /       \
                  yes        no
                   |          |
            Owner approval    |
                   \         /
                    v       v
              Live testnet quote
                    |
                    v
          Owner submits testnet deposit
                    |
                    v
          Tidepool settlement status
                    |
                    v
            Transaction + audit record
```

## Next implementation priorities

1. Isolated execution and constrained signing, with a threat model and independently verified TEE boundary.
2. Durable approval idempotency and atomic budget reservation.
3. Invoice, payroll and subscription workflows.
4. Accounting exports and reconciliation improvements.
5. AI request interpreter operating only as an untrusted proposer.

## Security principles

- Never place private keys in model prompts or model-accessible environments.
- Never let model output modify treasury policy.
- Never treat an LLM's claim that a payment is approved as authorization.
- Bind every live settlement destination to an owner-authorized recipient record.
- Require human approval above the configured threshold.
- Verify settlement status independently before recording a payment as successful.
- Keep all current settlement tests on testnet.
