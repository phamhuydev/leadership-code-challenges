# Decisions

## Scope

This is a take-home implementation of the specified mock PSP flow, not a production-ready real-money service. The challenge explicitly excludes authentication and deployment hardening. Those exclusions do not make the current endpoints safe to expose to untrusted callers.

## Money model and concurrency

Money enters and leaves the API as decimal strings, uses `bignumber.js` for arithmetic, and is stored as `DECIMAL(36,18)`. Input is rejected when it is nonpositive, has more than 18 fractional digits, or exceeds the column's integer precision. A wallet's `balance` is a materialized total; signed `wallet_txs.amount` entries allow that balance to be reconstructed. The balance update and ledger insert occur in one database transaction.

Each balance or turnover writer locks the wallet row with `SELECT ... FOR UPDATE` before checking and updating it. This serializes competing operations on the same wallet, so concurrent wagers cannot both spend the same funds. The deposit callback also locks its funding transaction row. A unique ledger reference to the funding transaction is a second guard against duplicate deposit credit.

The application only inserts ledger entries, but the database does not yet prohibit `UPDATE` or `DELETE` on `wallet_txs`. It also does not enforce `balance >= 0` or compare the materialized balance with the ledger. Production work must protect ledger rows with database permissions or a trigger, add the balance constraint, and run a reconciliation job that alerts on differences.

## Turnover policy

Completed deposits increase `wallets.turnover_required` by `amount * turnoverMultiplier`; wagers increase `wallets.turnover_accrued` by their amount. The withdrawal check and both counters use the same wallet lock as the balance. These are lifetime totals, matching the exercise's cumulative rule. This means wagering done before a later deposit can help satisfy that deposit's requirement; product and compliance owners must confirm whether production instead needs deposit-specific turnover obligations.

The exercise accepts `turnoverMultiplier` in the request, including zero. In production the server must derive it from trusted policy or promotion data; otherwise a caller can choose zero and bypass the control. The route currently accepts values larger than the PostgreSQL `INTEGER` column can store, which should be fixed by aligning API validation with the schema.

## PSP callbacks and state

Only `pending -> completed` and `pending -> failed` are applied. A retry with the same terminal status and amount returns success without a second credit; a conflicting transition returns 409. An unknown `pspRef` returns 404. The callback amount must exactly match the requested deposit amount. A mismatch returns 422 and leaves the deposit pending, rather than guessing which amount to credit.

This mock endpoint does **not** authenticate the PSP. Because deposit creation returns `pspRef`, any caller holding that reference can submit a fake `completed` callback and credit a wallet. A real integration must verify the provider's signature over the raw request body or use an equivalent provider-approved authentication method before the wallet service can process it. Invalid, unknown, mismatched, and out-of-order callbacks currently return errors without a durable event record. Production processing needs a verified inbound-event table, provider event deduplication, reconciliation cases, and alerts.

## Withdrawals and remaining work

A permitted withdrawal immediately debits the wallet and creates a pending funding transaction, as required by the exercise. A rejected payout, reversal, or cancellation has no implemented path. Production handling needs an authorized state transition and a separate idempotent compensating ledger credit; the original debit must remain in the ledger.

Client-originated deposit, wager, and withdrawal requests also lack idempotency keys. A client retry can create or debit twice. Before real use, we should add request-scoped keys with a unique database constraint and saved response, bind member identity to authorization, define currency and supported precision, and add audit logging, metrics, operational reconciliation, and payout handling. Extend tests for forged callbacks, failed and conflicting states, amount mismatches, client retries, ledger sums, and payout compensation. The database-backed tests have not been run in this environment because PostgreSQL/Docker was unavailable.

## Additional work beyond the requirements

- Added ESLint with a TypeScript-aware configuration and an `npm run lint` script. This gives reviewers a repeatable static check without affecting runtime dependencies.
- Added `test/tsconfig.json` so editors recognize Jest globals in test files while the production TypeScript build remains scoped to `src/`.
- Added a Postman collection with the full API call sequence, saved IDs and PSP references, and response checks for callback retries and the turnover lock. It supports manual exploration but does not replace database-backed automated tests.
- Routed health-check database failures through Express error handling and mapped duplicate usernames to HTTP 409, making those existing endpoints return useful errors.

## AI disclosure

OpenAI Codex was used to draft tests, ESLint configuration, postman collection and documents.
