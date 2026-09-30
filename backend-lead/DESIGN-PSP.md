# Designing for the 50th PSP

The current `/psp/callbacks` route is a mock: it accepts an unverified `pspRef` and status. For a real provider, the wallet service must receive only verified, normalized events. Provider-specific code cannot update balances.

```text
raw HTTPS callback
  -> provider adapter: verify signature, parse, normalize
  -> durable verified-event inbox (unique provider + event ID)
  -> worker: lock funding transaction, apply state + wallet/ledger atomically
  -> reconciliation case when the event cannot be applied safely
```

## Contract and configuration

```ts
type NormalizedCallback = {
  provider: string;
  providerEventId: string;
  providerReference: string;
  status: 'pending' | 'completed' | 'failed';
  amount: string; // Exact decimal in the configured currency.
  currency: string;
  occurredAt: Date;
};

interface PspAdapter {
  verify(rawBody: Buffer, headers: Headers, secrets: ProviderSecrets): void;
  normalize(rawBody: Buffer): NormalizedCallback;
}
```

A registry maps a provider and account to an adapter and validated configuration: enabled status, signing keys with rotation, supported currencies, and minor-unit conversion. The HTTP route keeps the raw body intact for signature verification. Each adapter owns the provider's signature rules, status vocabulary, and exact amount conversion. Configuration and secrets come from controlled server settings, not a client request. The wallet service derives turnover policy from trusted product configuration.

After verification, the endpoint durably records the event before acknowledging it. A unique `(provider, providerEventId)` key handles delivery retries; the funding state machine and unique ledger reference also protect against different event IDs for the same payment. The worker never reverses a completed deposit because a late `pending` event arrives. Unknown references, amount or currency mismatches, and conflicting terminal states become visible reconciliation cases with alerts. The provider payload and its hash are retained under an appropriate retention and access policy for investigation.

## One-day integration workflow

A junior engineer adds an adapter, typed provider configuration, and redacted fixtures. A shared contract suite checks valid and invalid signatures, changed bodies, stale timestamps or replay behavior where supported, status mapping, minor-unit precision, duplicate and out-of-order delivery, and unknown references. CI uses recorded fixtures, so it does not depend on a live provider. A separate sandbox smoke test confirms credentials and callback wiring. Release is controlled per provider, with metrics for verification failures, retries, processing latency, and reconciliation cases.
