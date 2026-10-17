# Asked Before MCP server

The Asked Before MCP server lets a coding agent record your how-to questions as captures, as you ask them, and run cold reps on your cards in the chat. It's a stdio server, built on the official MCP TypeScript SDK and on [the Asked Before SDK](/packages/sdk/README.md), that runs on your computer and reaches your Asked Before server with an API key. Its tools tell the agent to send only your own words: never its answer, your code, or secrets.

Contents:

1. [Tools](#tools)
1. [Settings](#settings)
1. [Set it up](#set-it-up)
1. [The Claude Code plugin](#the-claude-code-plugin)

## Tools

| Tool | What it does |
| --- | --- |
| `list_projects` | Lists your projects, each with its cards and how many are borrowed, returned, and borrowed again, and says which is the default. |
| `list_cards` | Lists a project's cards, most borrowed first; with `not_returned`, only those still waiting for a cold rep. |
| `record_question` | Records a question in your own words as a capture, and says whether it landed on a card you asked before, with its count and status, or waits unsorted. |
| `start_cold_rep` | Starts a cold rep on a card: the problem, and the lesson on its first cold rep or after a failed one. |
| `check_answer` | Checks your answer to a cold rep, as you wrote it: the verdict, the reason, and the card's status. |

A tool that works in a project takes it by name or id, or else uses the default project. Recording a question the model has to place, starting a cold rep, and checking an answer each count toward your account's daily cap of model requests. Past it, the tool answers with an error, and a question it couldn't record is lost unless the agent sends it again.

## Settings

The server reads its settings from its environment, and exits at once, naming them, when the address or the key is missing.

| Setting | What it holds |
| --- | --- |
| `ASKED_BEFORE_URL` | Your Asked Before server's address, such as `https://asked-before.example`. |
| `ASKED_BEFORE_API_KEY` | An API key from your Asked Before Settings page. |
| `ASKED_BEFORE_PROJECT` | Optional: the project, by name or id, that the tools use when a call names none. |

## Set it up

Your Asked Before server's Settings page and its docs page at `/docs` show these snippets with its own address filled in. Here they're shown for `https://asked-before.example`.

In Claude Code, install [the plugin](#the-claude-code-plugin). Without it, and in Claude Desktop and Cursor, the server runs from a copy of Asked Before: clone it and run `bun install`. In each snippet, put your copy's folder for `/path/to/asked-before`, and a key for `YOUR_API_KEY`.

Claude Code without the plugin, in a terminal:

```sh
claude mcp add \
  -e ASKED_BEFORE_URL=https://asked-before.example \
  -e ASKED_BEFORE_API_KEY=YOUR_API_KEY \
  --transport stdio --scope user \
  asked-before -- bun /path/to/asked-before/packages/mcp/src/server.ts
```

Claude Desktop: open Settings, then Developer, then Edit Config, and add this to `claude_desktop_config.json`. For `/path/to/bun`, put the path that `which bun` prints, since Claude Desktop may not see your shell's `PATH`. Then restart Claude Desktop.

```json
{
  "mcpServers": {
    "asked-before": {
      "command": "/path/to/bun",
      "args": ["/path/to/asked-before/packages/mcp/src/server.ts"],
      "env": {
        "ASKED_BEFORE_URL": "https://asked-before.example",
        "ASKED_BEFORE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

Cursor: add this to `~/.cursor/mcp.json`, or to `.cursor/mcp.json` for one project, with bun's path as for Claude Desktop.

```json
{
  "mcpServers": {
    "asked-before": {
      "type": "stdio",
      "command": "/path/to/bun",
      "args": ["/path/to/asked-before/packages/mcp/src/server.ts"],
      "env": {
        "ASKED_BEFORE_URL": "https://asked-before.example",
        "ASKED_BEFORE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

## The Claude Code plugin

The Asked Before plugin, in `plugins/asked-before` at the repo's root, brings this server and a skill to Claude Code in one install. The skill tells Claude Code when to record a question, to offer a cold rep when a question is on a card you asked before, and to give no hints during one. A marketplace install copies only the plugin's folder, so the plugin carries a single-file build of this server, `dist/server.js`, which its `.mcp.json` launches with Node.js 20 or later.

Install it from the marketplace in Asked Before's repository, in a terminal:

```sh
claude plugin marketplace add m1kuorg/asked-before
claude plugin install asked-before@asked-before \
  --config server_url=https://asked-before.example \
  --config api_key=YOUR_API_KEY
```

Then start a new Claude Code session. To pick a default project too, add `--config project=Work`.

After a change to this server or to the SDK, rebuild the plugin's server and check the plugin:

```sh
bun run build:plugin
bun run check:plugin
```
