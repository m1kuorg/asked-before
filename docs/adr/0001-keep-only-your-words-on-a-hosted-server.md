---
status: accepted
---

# Keep only your own words, on a hosted server

The proof of concept was a local server that stored nothing. The app is hosted, with accounts, so cards, reps, and agent captures last between visits and devices, and an SDK and MCP server can reach them. To keep the proof of concept's privacy line, the browser (or the SDK) reads the export and uploads only your phrasings: an opaque id, the text, and the time. The chatbot's answers, titles, and system or tool messages never reach the server, which stores phrasings, cards, and reps and logs no phrasing text.

Proposed by an agent on October 17, 2026, from the recommended answer to a question the entrant hadn't answered yet, and accepted by the entrant on October 18, 2026.

## Considered options

- **Local-first: Bun and SQLite on your own computer, with your own key.** Keeps "the server stores nothing", but there'd be no cross-device history, no API keys, and no remote agent access.
- **Upload the whole export and filter on the server.** One parser path, but the server would see the chatbot's answers.
