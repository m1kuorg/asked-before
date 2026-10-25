<a id="readme-top"></a>

<!-- PROJECT LOGO -->

<br />
<div align="center">
  <a href="https://github.com/m1kuorg/asked-before">
    <img src="/docs/readme/banner.png" alt="Asked Before banner: “Asked before?” in large white type on a plum field over faint pink lines of how-to questions, beside “If you keep asking a chatbot the same how-to, Asked Before finds those questions in your own chat history, then tests you on each one without AI.”">
  </a>

  <h3>Asked Before</h3>

  <p>
    Finds the how-to questions you keep asking AI in your ChatGPT or Claude export, makes each a card, and tests you on it without AI until it's proven.
    <br />
    <a href="https://asked-before.m1kuorg.workers.dev"><strong>Live Demo &rarr;</strong></a>
    &middot;
    <a href="#screenshots">Screenshots</a>
    &middot;
    <a href="https://github.com/m1kuorg/asked-before/issues/new?labels=bug">Report a Bug</a>
    <br />
  </p>

[![TypeScript][typescript-badge]][typescript-url]
[![React][react-badge]][react-url]
[![Tailwind CSS][tailwindcss-badge]][tailwindcss-url]
[![shadcn/ui][shadcnui-badge]][shadcnui-url]
[![Bun][bun-badge]][bun-url]
[![Cloudflare Workers][cloudflareworkers-badge]][cloudflareworkers-url]
[![Cloudflare D1][cloudflared1-badge]][cloudflared1-url]
[![Claude][claude-badge]][claude-url]
[![Model Context Protocol][modelcontextprotocol-badge]][modelcontextprotocol-url]
[![Playwright][playwright-badge]][playwright-url]
[![Zod][zod-badge]][zod-url]

</div>

<!-- TABLE OF CONTENTS -->

## Table of Contents

<details>
  <summary>Expand</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#screenshots">Screenshots</a></li>
        <li><a href="#how-it-works">How It Works</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#architecture">Architecture</a></li>
        <li><a href="#tech-stack">Tech Stack</a></li>
      </ul>
    </li>
    <li>
      <a href="#hackathon">Hackathon</a>
      <ul>
        <li><a href="#skill-pack-and-planning-docs">Skill Pack and Planning Docs</a></li>
        <li><a href="#testing">Testing</a></li>
        <li><a href="#disclosures">Disclosures</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#team">Team</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

Turn a question you keep asking into one you can answer without AI. You ask a chatbot how to undo a git commit, and months later you ask again in other words. Asked Before reads your own messages from a ChatGPT or Claude export and puts the ones that ask how to do the same thing on one card, most asked first, with every ask dated from the message's own timestamp. A card is Proven only once you pass a cold rep: a fresh problem of the same skill, answered in a plain box without AI. Ask it again after that, and the card needs a fresh cold rep.

Your browser reads the export and sends only your own messages, each with when you sent it and the export's own id for it, so a re-upload isn't counted twice; the upload itself carries the file's name and which chatbot it came from. The chatbot's answers and your conversation titles stay behind, and the model sees your words only, never your dates. Code does the counting and dating; the model sorts your words onto cards, writes each card's lesson and problems, and checks your answers. The [privacy page](https://asked-before.m1kuorg.workers.dev/privacy) has the whole list.

It's for students and early-career developers who ask a chatbot many times a day and suspect they aren't learning from it. Coding agents record your questions onto the same cards as you ask them, through the MCP server or the Claude Code plugin.

Built for [Build With AI: Basics](https://learn-ai-basics.devpost.com/), Devpost's learning hackathon, with the Devpost Learn Skill Pack. See [Hackathon](#hackathon).

<p align="right"><a href="#readme-top">&uarr;</a></p>

### Screenshots

Landing, Search, Connect your AI, Playground, and Privacy show the live app as the guest. Home, Analysis, and Roadmap show a local copy, signed in as a made-up learner who uploaded the demo export, with the real model.

<table>
  <tr>
    <td width="50%" valign="top" align="left">
      <img src="/docs/readme/screenshots/landing.png" alt="Landing" width="100%">
      <br />
      <strong>Landing</strong> · The public page asks "Asked before?", with a guest sign-in that needs no account.
    </td>
    <td width="50%" valign="top" align="left">
      <img src="/docs/readme/screenshots/home.png" alt="Home" width="100%">
      <br />
      <strong>Home</strong> · The cards that need a cold rep across your shelves, most asked first, beside your latest asks.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top" align="left">
      <img src="/docs/readme/screenshots/search.png" alt="Search" width="100%">
      <br />
      <strong>Search</strong> · "Have you asked this before?" finds every message of yours with all the words, and the cards they're on.
    </td>
    <td width="50%" valign="top" align="left">
      <img src="/docs/readme/screenshots/analysis.png" alt="Analysis" width="100%">
      <br />
      <strong>Analysis</strong> · How you ask, counted from your messages' own times: what you'd asked before, month by month, the wait until you asked again, and cold reps.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top" align="left">
      <img src="/docs/readme/screenshots/roadmap.png" alt="Roadmap" width="100%">
      <br />
      <strong>Roadmap</strong> · Your cards on a path of 13 developer areas, from the terminal to deploying, with the next one to prove.
    </td>
    <td width="50%" valign="top" align="left">
      <img src="/docs/readme/screenshots/connect-your-ai.png" alt="Connect your AI" width="100%">
      <br />
      <strong>Connect your AI</strong> · Pick your agent and paste its setup, with this server's address filled in. A key made for the agent needs an account.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top" align="left">
      <img src="/docs/readme/screenshots/playground.png" alt="Playground" width="100%">
      <br />
      <strong>Playground</strong> · Send one real API request, as this session or with a key, and read the whole answer beside the same request as code.
    </td>
    <td width="50%" valign="top" align="left">
      <img src="/docs/readme/screenshots/privacy.png" alt="Privacy" width="100%">
      <br />
      <strong>Privacy</strong> · What leaves your computer, what the model sees, what's kept, and how to delete it.
    </td>
  </tr>
</table>

<p align="right"><a href="#readme-top">&uarr;</a></p>

### How It Works

1.  **Upload a chat export.** Make a shelf for one part of your life, such as Work or Bootcamp, and drop in a ChatGPT or Claude export: the zip, or the `conversations.json` inside it. Your browser reads it and shows what will leave your computer before anything is sent. No export yet? Choose **Try the demo shelf**, made from a labeled demo export, or try it as a guest.

    <img src="/docs/readme/steps/1-upload-a-chat-export.png" alt="Upload a chat export" width="100%">

2.  **See what you keep asking.** The sort puts the messages that ask how to do the same thing on one card, most asked first, with a pink dot for every time you asked. A message nothing else asks yet stays Not on a card.

    <img src="/docs/readme/steps/2-see-what-you-keep-asking.png" alt="See what you keep asking" width="100%">

3.  **Prove it without AI.** A card shows every time you asked, word for word. Start a cold rep for the lesson behind it and a fresh problem of the same skill, then answer in a plain box without AI.

    <img src="/docs/readme/steps/3-prove-it-without-ai.png" alt="Prove it without AI" width="100%">

4.  **Fail, and try again.** A failed rep says Not yet, with the reason and the lesson again. The next cold rep is a different problem.

    <img src="/docs/readme/steps/4-fail-and-try-again.png" alt="Fail, and try again" width="100%">

5.  **Proven, until you ask again.** A pass marks the card Proven with the date. Ask it again after that, in a new export or through your agent, and it's Asked since proven, waiting for a fresh cold rep.

    Steps 1 to 3 show the live app as the guest. Steps 4 and 5 show the local copy from [Screenshots](#screenshots), with the real model's reason and lesson.

    <img src="/docs/readme/steps/5-proven-until-you-ask-again.png" alt="Proven, until you ask again" width="100%">

<p align="right"><a href="#readme-top">&uarr;</a></p>

### Features

- **Your words only.** Only your own messages leave your computer, with their times and ids. The chatbot's answers and your titles never do, and the model never sees your dates.
- **Cards from your own history.** ChatGPT and Claude exports, sorted onto cards per shelf, most asked first. Shelves never share cards.
- **Cold reps.** A lesson written once, a fresh problem every rep, and a verdict with its reason.
- **Search, Analysis, and Roadmap.** Counted by code, never the model, so none of them spends a model request.
- **From your agent.** An MCP server with five tools, `list_shelves`, `list_cards`, `record_question`, `start_cold_rep`, and `check_answer`, and a Claude Code plugin ([README](/packages/mcp/README.md)). A question you ask an agent is recorded as you ask it, and lands on its card, or waits unsorted until something else asks the same.
- **SDK and API.** `@asked-before/sdk`, a typed TypeScript client for the HTTP API with the export readers, built from a clone since it isn't on npm ([README](/packages/sdk/README.md)); every endpoint listed at `/docs`; and the Playground for one real request.
- **Guest workspace.** Try it with no account: every guest shares one sorted demo shelf, wiped back at midnight UTC.
- **Your data.** API keys shown once, a download of everything Asked Before keeps, and account deletion.
- **No password on the server.** The page derives a key from your password with scrypt, and the server keeps only a salted SHA-256 of that key.
- **Honest limits.** On Workers Free the whole app gets 20 model requests and 8,000 messages a day, guests included, and says so when a cap is reached.

<p align="right"><a href="#readme-top">&uarr;</a></p>

### Architecture

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/docs/readme/architecture-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="/docs/readme/architecture-light.svg">
  <img src="/docs/readme/architecture-light.svg" alt="Asked Before architecture">
</picture>

Made with [Archify](https://github.com/tt-a1i/archify) from [`architecture.json`](/docs/readme/architecture.json).

<p align="right"><a href="#readme-top">&uarr;</a></p>

### Tech Stack

- **Languages:** TypeScript for the Worker, the pages, the SDK, the MCP server, and the checks.
- **Frontend:** [React](https://react.dev/) 19, [Tailwind CSS](https://tailwindcss.com/) 4, and [shadcn/ui](https://ui.shadcn.com/) on [Base UI](https://base-ui.com/), bundled by [Bun](https://bun.com/), with self-hosted Schibsted Grotesk and JetBrains Mono.
- **Backend:** [Cloudflare Workers](https://developers.cloudflare.com/workers/), [D1](https://developers.cloudflare.com/d1/) with Wrangler's migrations, a [Durable Object](https://developers.cloudflare.com/durable-objects/) per shelf that runs its sort, and a cron every five minutes that restarts stalled sorts and resets the guest workspace.
- **AI:** Anthropic's [Claude](https://claude.com/product/overview) Haiku 5.5 (`claude-haiku-5-5`) with structured outputs, through the Anthropic TypeScript SDK.
- **Agents:** an MCP server on the [Model Context Protocol](https://modelcontextprotocol.io/) TypeScript SDK and [Zod](https://zod.dev/), and a [Claude Code](https://claude.com/product/claude-code) plugin.
- **Tooling:** [Wrangler](https://developers.cloudflare.com/workers/wrangler/), TypeScript, and [Playwright](https://playwright.dev/) for end-to-end checks. There are no unit tests.

<p align="right"><a href="#readme-top">&uarr;</a></p>

<!-- HACKATHON -->

## Hackathon

Built for [Build With AI: Basics](https://learn-ai-basics.devpost.com/), Devpost's learning hackathon, between September 22 and October 26, 2026.

<p align="right"><a href="#readme-top">&uarr;</a></p>

### Skill Pack and Planning Docs

The repository started empty on October 16, 2026, and its first commit installs the [Devpost Learn Skill Pack](https://github.com/challengepost/learn-ai-basics), pinned in [`skills-lock.json`](/skills-lock.json). Its skills wrote the planning docs in [`devpost/`](/devpost):

- [`scope.md`](/devpost/scope.md), from `2-scope`: the idea, cut down to a proof of concept.
- [`prd.md`](/devpost/prd.md), from `3-prd`: the journey, every behavior, and the proof of concept's boundary.
- [`spec.md`](/devpost/spec.md), from `4-spec`: the stack, components, data, and files.
- [`checklist.md`](/devpost/checklist.md) and [`app-map.html`](/devpost/app-map.html), from `5-build`: the build steps, each verified and committed.

The proof of concept, one page running the whole journey on a made-up demo export, is `main`'s history up to commit [`b1d7e64`](https://github.com/m1kuorg/asked-before/tree/b1d7e64), and `devpost/` describes only that proof of concept. The app grew from it within the submission period, through accounts, Cloudflare Workers, a redesigned frontend, and the screens above, following tickets in the private planning repository rather than the Skill Pack. [`PRODUCT.md`](/PRODUCT.md), [`GLOSSARY.md`](/GLOSSARY.md), [`docs/adr/`](/docs/adr), and [`docs/code-map.md`](/docs/code-map.md) describe the app as it is now.

<p align="right"><a href="#readme-top">&uarr;</a></p>

### Testing

- **Live app.** Open [asked-before.m1kuorg.workers.dev](https://asked-before.m1kuorg.workers.dev) and choose **Try it as a guest**. It needs no account, password, or payment. Every guest shares one workspace that already holds a sorted demo shelf, wiped back at midnight UTC.
- **Demo data.** The demo shelf comes from [`demo/export.json`](/demo/export.json), a made-up chat export, labeled as demo data wherever it shows. Its top card is "Undo a git commit", asked 9 times.
- **Shared workspace.** Every guest sees what any guest uploads, with its cards and cold reps, until the midnight wipe.
- **Daily caps.** The whole app gets 20 model requests a day, shared by everyone, and they reset at midnight UTC. Search, Analysis, the Roadmap, and browsing cards spend none. A cold rep spends 2, one to write the problem and one to check the answer, so the day holds about 10 across all visitors; an upload's sort and an agent's recorded question spend some too. Past the cap, the app says so. To try more, run it locally with your own key and raise the cap, as [Getting Started](#getting-started) says.

<p align="right"><a href="#readme-top">&uarr;</a></p>

### Disclosures

**AI assistance.** The entrant works with Astra 6 via Codex, Claude 5.5 via Claude Code, Gemini models via Antigravity, and DeepSeek, GLM, etc. models via OMP as coding assistants throughout the development of the project. The entrant worked with the Devpost Learn Skill Pack manually by directly stepping through each stage (`1-start` through `6-ship`), answering the interview prompts to formulate the planning documents (`scope.md`, `prd.md`, and `spec.md`), and conducting the hands-on testing and review checkpoints across each build slice in `checklist.md`.

**Pre-existing work.** None. The project was newly created during the hackathon submission period, with no pre-existing work.

<p align="right"><a href="#readme-top">&uarr;</a></p>

<!-- GETTING STARTED -->

## Getting Started

Asked Before runs on your computer under `wrangler dev`, which runs it as Cloudflare Workers would, with no Cloudflare account. Sorts and cold reps need an Anthropic API key; the rest of the app runs without one.

<p align="right"><a href="#readme-top">&uarr;</a></p>

### Prerequisites

- [Bun](https://bun.com/) 1.4 or later.
- [Node.js](https://nodejs.org/) 22 or later, which Wrangler runs on.
- An [Anthropic API key](https://platform.claude.com/), for sorts and cold reps.

<p align="right"><a href="#readme-top">&uarr;</a></p>

### Installation

1.  **Clone and install.**

    ```sh
    git clone https://github.com/m1kuorg/asked-before.git
    cd asked-before
    bun install
    ```

2.  **Add your key.** Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. `.env` is gitignored, and a key exported in your shell works too.

    ```sh
    cp .env.example .env
    ```

3.  **Start the app.** `bun run dev` builds the pages into `dist/`, applies the D1 migrations to a local database in `.wrangler/`, and starts `wrangler dev`.

    ```sh
    bun run dev
    ```

4.  **Open it.** Open the address Wrangler prints, [http://localhost:8787](http://localhost:8787) unless that port is taken. Sign up and choose **Try the demo shelf** on Home, or try it as a guest. Your local data stays in `.wrangler/`; delete that folder to start again. Wrangler reloads the Worker when its code changes, but not the pages: run `bun run build:pages` after changing them.

    The local app keeps the live app's daily caps, from `wrangler.jsonc`'s `vars`: 20 model requests and 8,000 messages a day. For more, raise `SITE_DAILY_MODEL_REQUESTS` and `SITE_DAILY_PHRASINGS` there and start the app again.

5.  **Run the checks.** Each check starts its own copy of the app with a fresh database and drives it from outside: through the SDK, in a real browser, or with the official MCP client. The browser checks need Playwright's Chromium once.

    ```sh
    bunx playwright install chromium
    bun run typecheck
    bun run journey
    ```

    `bun run journey` walks the core journey in Chromium with the real model, in 7 model calls: it signs up, uploads the demo export, fails and then passes a cold rep, makes an API key, lists the cards through the SDK, and records a question through the MCP server. `package.json` has a `check:*` script for each area, such as `check:guest`, `check:search`, and `check:mcp`. Most stub the model inside the script; the few that call the real model need the key.

6.  **Optionally, deploy to Cloudflare.** It runs on Workers Free. `wrangler.jsonc` holds the live app's database id and address, so replace both with your own. With your key exported in your shell, log in, make the database, and replace the `database_id` in `wrangler.jsonc`'s `DB` binding with its id. Then apply the migrations and set the key as the Worker's secret; Wrangler offers to create the Worker for it.

    ```sh
    bunx wrangler login
    bunx wrangler d1 create asked-before
    bunx wrangler d1 migrations apply DB --remote
    printenv ANTHROPIC_API_KEY | bunx wrangler secret put ANTHROPIC_API_KEY
    ```

    Replace `PUBLIC_URL` in `wrangler.jsonc`'s `vars` with your app's address, then build and deploy. To deploy a change, apply any new migrations first, then build and deploy again.

    ```sh
    bun run build:pages
    bunx wrangler deploy
    ```

    `SITE_DAILY_MODEL_REQUESTS` and `SITE_DAILY_PHRASINGS` in `vars` cap the whole app's day, to stay under D1 Free's 100,000 rows written a day; raise them on Workers Paid. D1's Time Travel keeps 7 days of the database's history on the free plan and 30 on a paid one, and can't be turned off, so what a learner deletes stays in Cloudflare's backups for up to 30 days.

<p align="right"><a href="#readme-top">&uarr;</a></p>

<!-- ROADMAP -->

## Roadmap

See [open issues](https://github.com/m1kuorg/asked-before/issues) for a full list of proposed features (and known issues).

<p align="right"><a href="#readme-top">&uarr;</a></p>

<!-- CONTRIBUTING -->

## Team

<a href="https://github.com/m1kuorg/asked-before/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=m1kuorg/asked-before" alt="Asked Before team" />
</a>

Made with [contrib.rocks](https://contrib.rocks).

<p align="right"><a href="#readme-top">&uarr;</a></p>

<!-- LICENSE -->

## License

See [LICENSE](/LICENSE) for more information.

Third-party files keep their own licenses:

- The Devpost Learn Skill Pack, [MIT](https://github.com/challengepost/learn-ai-basics/blob/main/LICENSE), Copyright (c) 2026 Devpost, in `.agents/skills/`, `agent/skills/`, and `.claude/skills/`.
- The impeccable skill, Apache 2.0, in `.claude/skills/impeccable/` and `.claude/agents/`.
- shadcn/ui's components, MIT, the starting point of `src/components/ui/`.
- The MCP TypeScript SDK's server and core, Apache 2.0, and Zod and `@noble/hashes`, MIT, bundled into the plugin's built server, `plugins/asked-before/dist/server.js`.
- Schibsted Grotesk and JetBrains Mono, SIL Open Font License 1.1, in `public/fonts/`.
- The landing page's archival pictures and film, each credited on the page and listed with its source and license in [`public/images/credits.json`](/public/images/credits.json): two photographs under CC BY 4.0, and a photograph and a newsreel in the public domain. The banner is the landing page's opening chapter, whose field is adapted from ["Nurmeksen yhteislyseo vuonna 1958. Ylioppilaskirjoitukset."](https://commons.wikimedia.org/wiki/File:Nurmeksen_yhteislyseo_vuonna_1958_Ylioppilaskirjoitukset_(5394%2B(numero)).jpg) by Topi Toivanen, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0), via Wikimedia Commons: the photograph is rebuilt in the demo's questions, set in type.

<p align="right"><a href="#readme-top">&uarr;</a></p>

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

- [Build With AI: Basics](https://learn-ai-basics.devpost.com/) and the [Devpost Learn Skill Pack](https://github.com/challengepost/learn-ai-basics): the hackathon, and the skills that planned and built the proof of concept.
- [Anthropic](https://www.anthropic.com/): Claude Haiku 5.5 sorts the cards and writes the cold reps.
- [Cloudflare](https://www.cloudflare.com/): Workers, D1, and Durable Objects host the live app.
- [shadcn/ui](https://ui.shadcn.com/) and [Base UI](https://base-ui.com/): the app's components.
- [impeccable](https://impeccable.style/) and [taste-skill](https://github.com/leonxlnx/taste-skill): the design skills behind the frontend.
- [Schibsted Grotesk](https://fonts.google.com/specimen/Schibsted+Grotesk) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/): the type.
- Topi Toivanen, Bror Brandt, Harris & Ewing, and Polygoon Hollands Nieuws, via [Wikimedia Commons](https://commons.wikimedia.org/): the landing page's pictures and film; Topi Toivanen's photograph also underlies the banner.
- [Archify](https://github.com/tt-a1i/archify)
- [contrib.rocks](https://contrib.rocks)
- [Shields.io](https://shields.io)

<p align="right"><a href="#readme-top">&uarr;</a></p>

<!-- MARKDOWN LINKS & IMAGES -->

[typescript-badge]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[typescript-url]: https://www.typescriptlang.org/
[react-badge]: https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black
[react-url]: https://react.dev/
[tailwindcss-badge]: https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white
[tailwindcss-url]: https://tailwindcss.com/
[shadcnui-badge]: https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white
[shadcnui-url]: https://ui.shadcn.com/
[bun-badge]: https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white
[bun-url]: https://bun.com/
[cloudflareworkers-badge]: https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflareworkers&logoColor=white
[cloudflareworkers-url]: https://developers.cloudflare.com/workers/
[cloudflared1-badge]: https://img.shields.io/badge/Cloudflare_D1-F38020?style=for-the-badge&logo=cloudflare&logoColor=white
[cloudflared1-url]: https://developers.cloudflare.com/d1/
[claude-badge]: https://img.shields.io/badge/Claude-D97757?style=for-the-badge&logo=claude&logoColor=white
[claude-url]: https://claude.com/product/overview
[modelcontextprotocol-badge]: https://img.shields.io/badge/Model_Context_Protocol-000000?style=for-the-badge&logo=modelcontextprotocol&logoColor=white
[modelcontextprotocol-url]: https://modelcontextprotocol.io/
[playwright-badge]: https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge
[playwright-url]: https://playwright.dev/
[zod-badge]: https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white
[zod-url]: https://zod.dev/
