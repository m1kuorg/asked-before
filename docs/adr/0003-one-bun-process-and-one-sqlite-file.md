---
status: superseded by ADR-0005
---

# One Bun process and one SQLite file

The server is one Bun process with its data in one SQLite file, read through `bun:sqlite` behind a single store module. A fresh clone runs the whole app with only an Anthropic key and no other services, and a backup is one file. A deployment needs a persistent disk, and it scales to one machine; moving to Postgres means rewriting the store module, not its callers.

## Considered options

- **Hosted Postgres, such as Neon or Supabase.** Scales out, but every clone and agent run needs a provisioned database and credentials before anything runs.
