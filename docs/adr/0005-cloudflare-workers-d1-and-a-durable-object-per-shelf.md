---
status: accepted
---

# Cloudflare Workers, D1, and a Durable Object per shelf

The app runs on Cloudflare Workers, so a learner reaches it at a public address from any computer, rather than as one Bun process with one SQLite file on a disk of its own (ADR 0003, which this supersedes). One Worker answers the API under `/api/v1`, and the pages are static assets that Bun builds beforehand. The data is in one D1 database, whose schema is Wrangler's D1 migrations; D1 has no interactive transactions, so a write that depends on a read folds that read into its SQL, in one `batch()`. Each shelf's sort runs in a Durable Object named by the shelf's id, one batch per alarm, so a shelf sorts one upload at a time and a sort carries on after a restart or a deploy. Workers have no argon2, so passwords were hashed on the server with scrypt at N=2^14, r=8, p=5; ADR 0006 supersedes that, since the app now runs on Workers Free. There a request, a cron run, and each of a Durable Object's alarms has 10 ms of CPU time, which everything but scrypt fits, and Durable Objects are on Free too. D1 Free's 100,000 rows written a day, for the whole Cloudflare account, is the real ceiling, since every query fails past it, logging in too; daily caps on phrasings and model requests, each for the whole app and counted once for everyone, keep it under that; each account had its own as well until m1kuorg/basics#73. Workers Paid, $5 a month, lifts the CPU and D1 limits. A fresh clone still runs the whole app with only an Anthropic key and no Cloudflare account, through `wrangler dev`, which needs Node.js 22 or later beside Bun.

D1's Time Travel keeps 7 days of a database's history on Workers Free and 30 on Paid, and it can't be turned off, so anything a learner deletes stays in Cloudflare's backups for up to 30 days. The settings page says so beside downloading and deleting your data, and so does the docs page beside deleting the account.

The entrant chose Cloudflare Workers on October 18, 2026 (m1kuorg/basics#60), and its Free plan on October 19 (m1kuorg/basics#68). The m1kuorg/basics numbers here are tickets in the private planning repository.

## Considered options

- **One SQLite Durable Object for all the data.** Its transactions are synchronous, as bun:sqlite's were, but logging in by email, finding a session or an API key by its hash, and the throttle on signing up and logging in cross accounts, so it would be one global object, with D1's throughput and without D1's migrations, export, and Time Travel.
- **Queues or Workflows for the sort.** Queues can't promise one sort per shelf, since their concurrency is per queue, and Workflows would still need a Durable Object to keep a shelf's sorts in order. `waitUntil` gives a request only 30 seconds more, too short for one batch.
- **PBKDF2 at 100,000 iterations, on Workers Free.** Free's 10 ms of CPU can't hold scrypt at OWASP's settings, and PBKDF2 at the production cap is a sixth of OWASP's figure.
