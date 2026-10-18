---
status: accepted
---

# Cloudflare Workers, D1, and a Durable Object per shelf

The app runs on Cloudflare Workers, so a learner reaches it at a public address from any computer, rather than as one Bun process with one SQLite file on a disk of its own (ADR 0003, which this supersedes). One Worker answers the API under `/api/v1`, and the pages are static assets that Bun builds beforehand. The data is in one D1 database, whose schema is Wrangler's D1 migrations; D1 has no interactive transactions, so a write that depends on a read folds that read into its SQL, in one `batch()`. Each shelf's sort runs in a Durable Object named by the shelf's id, one batch per alarm, so a shelf sorts one upload at a time and a sort carries on after a restart or a deploy. Workers have no argon2, so passwords are hashed with scrypt at N=2^14, r=8, p=5, with the parameters stored beside each hash. That hash's CPU time and the Durable Object need Workers Paid. A fresh clone still runs the whole app with only an Anthropic key and no Cloudflare account, through `wrangler dev`, which needs Node.js 22 or later beside Bun.

D1's Time Travel keeps 30 days of a database's history on Workers Paid, and it can't be turned off, so anything a learner deletes stays in Cloudflare's backups for up to 30 days. The settings page says so beside downloading and deleting your data, and so does the docs page beside deleting the account.

The entrant chose Cloudflare Workers on October 18, 2026 (m1kuorg/basics#60).

## Considered options

- **One SQLite Durable Object for all the data.** Its transactions are synchronous, as bun:sqlite's were, but logging in by email, finding a session or an API key by its hash, and the throttle on signing up and logging in cross accounts, so it would be one global object, with D1's throughput and without D1's migrations, export, and Time Travel.
- **Queues or Workflows for the sort.** Queues can't promise one sort per shelf, since their concurrency is per queue, and Workflows would still need a Durable Object to keep a shelf's sorts in order. `waitUntil` gives a request only 30 seconds more, too short for one batch.
- **PBKDF2 at 100,000 iterations, on Workers Free.** Free's 10 ms of CPU can't hold scrypt at OWASP's settings, and PBKDF2 at the production cap is a sixth of OWASP's figure.
