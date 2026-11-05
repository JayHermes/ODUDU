# Odudu

**Policy-controlled financial execution for AI-assisted businesses.**

Odudu is built around one rule: an AI agent may propose a financial action, but it must not control the authority that approves or executes it.

## Current status — prototype 0.1

This first slice contains a deterministic TypeScript policy engine independent of any model, a server-side `POST /api/transactions/evaluate` endpoint with request validation, a small web interface for testing payment requests, and unit tests for approval, escalation and rejection cases.

**This prototype does not connect to a wallet, NEAR, NEAR Intents, a TEE, a database or an LLM. It does not move funds.** The policy values are hard-coded demo values and are not production security controls.

## Stack

- Next.js App Router + React + TypeScript
- Zod for input validation
- Vitest for policy tests
- Designed for Vercel deployment

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Run tests with `npm test`; build with `npm run build`.

## Demo policy

| Rule | Value |
|---|---:|
| Maximum single payment | $1,000 |
| Daily budget | $2,500 |
| Already spent today | $450 |
| Human approval above | $300 |

Allowed recipients: `vendor-acme`, `cloud-hosting`, `payroll-provider`.

These are demonstration values, not recommendations for a real treasury.

## Architecture direction

```text
Payment request / AI proposal
            |
            v
    Input validation
            |
            v
  Independent policy engine
       /          \
   reject       approve / escalate
                     |
                     v
         Restricted execution service
                     |
                     v
              NEAR Intents
                     |
                     v
          Receipt + audit record
```

## Next implementation steps

1. Persist policy versions and transaction decisions in a database.
2. Add an explicit human-approval workflow.
3. Integrate NEAR Intents in testnet with a restricted execution service.
4. Add a real trusted execution boundary and key-management design before describing the system as TEE-secured.
5. Add the AI request interpreter as an untrusted proposer that can only call the policy evaluation interface.

## Security boundaries

- Never put a private key in a model prompt or model-accessible environment.
- Never let model output modify policy configuration.
- Never treat an LLM's claim that a payment is approved as authorization.
- A policy decision is not proof of settlement. Settlement must be verified independently.
- Do not use the demo endpoint to authorize real payments.
