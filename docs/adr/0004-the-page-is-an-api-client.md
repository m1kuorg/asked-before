---
status: proposed
---

# The page is a client of the public API

The web page talks to the server only through the same versioned HTTP API, using the same SDK, that third-party scripts and the MCP server use. The browser authenticates with a session cookie, and everything else with an API key. There's one contract to keep stable and to prove end to end; the cost is that a screen needing new data waits for a public endpoint, rather than taking a private shortcut.
