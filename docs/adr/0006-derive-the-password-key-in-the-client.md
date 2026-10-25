---
status: accepted
---

# Derive the password's key in the client

The app runs on Workers Free, where a request has 10 ms of CPU time, and scrypt at OWASP's settings takes about 70 ms, so a server that hashed passwords failed every log-in. So the SDK, which the page uses too (ADR 0004), derives a key from the password with scrypt at N=2^14, r=8, p=5 in pure JavaScript, salted with `asked-before/1:` and the account's email, trimmed and lowercased, and the API takes that key, never the password. The server keeps a SHA-256 of the key under a random salt of the account's own, compared in constant time, which takes microseconds. Guessing a key from a stored hash still means running scrypt on each guessed password, so a second slow hash on the server adds nothing, and no secret pepper is kept: a copy of the database costs a guesser what it did before. This supersedes ADR 0005's password hashing.

What it costs: the salt is predictable, so an attacker who knows an email can spend scrypt's work on it before any breach, where a random salt made them wait for one; and the server can't hold a password to its length any more, so the SDK does. What it gains beside fitting Free: a password reused elsewhere never reaches the server or its logs. Each guess still costs scrypt, online or offline. The email salts the key, so changing the email needs the password, and sends the key both emails make.

The entrant chose Workers Free on October 19, 2026, and this way to fit it (m1kuorg/basics#68, a ticket in the private planning repository).

## Considered options

- **PBKDF2 on the server.** WebCrypto runs it natively, but 100,000 iterations already take 6 ms of the 10, and that's a sixth of OWASP's figure.
- **Passkeys.** The strongest, and the server would keep no secret, but losing a device needs recovery codes or a password again, the RP ID ties accounts to one domain, and four routes, a challenge store, and a software authenticator for the checks are a large change.
- **Sign in with GitHub, or magic links.** Either keeps no password, but makes everyone hold a GitHub account, or needs an email service, which Cloudflare sends only on Paid.
- **Workers Paid.** $5 a month lifts the CPU limit and keeps server-side scrypt, but the entrant chose Free.
