// The roadmap's path and its placing rule (app-notes/depth/plan.md, "2.
// Roadmap"), in one place, as data. The areas run in path order, from the
// terminal to deploying, each with the words that place a card on it.
// Placing is code, in one stage, and never asks the model: lowercase the
// card's skill name and split it into words on anything but letters,
// digits, # and +; an area scores how many distinct words of its list are
// among them; the highest score wins, a tie goes to the earlier area on the
// path, and a score of 0 leaves the card elsewhere, off the path. The words
// are compared as data (a Map lookup), so no pattern is ever built from a
// learner's text.

import type { RoadmapAreaId } from "@asked-before/sdk";

export type Area = { id: RoadmapAreaId; name: string; about: string; words: string[] };

export const AREAS: Area[] = [
  {
    id: "terminal",
    name: "Terminal and the OS",
    about: "The shell, files and paths, processes, ports, and permissions.",
    words: [
      "terminal", "shell", "bash", "zsh", "command", "commands", "cli", "port", "ports", "process", "processes", "path", "ssh", "permission", "permissions",
      "chmod", "sudo", "linux", "macos", "unix", "directory", "folder", "symlink", "grep", "cron", "kill", "tmux", "vim", "homebrew", "brew",
    ],
  },
  {
    id: "git",
    name: "Git",
    about: "Commits, branches, merges, and undoing what you did.",
    words: ["git", "github", "gitlab", "commit", "commits", "branch", "branches", "merge", "rebase", "stash", "cherry", "squash", "checkout", "revert", "clone", "remote", "conflict", "conflicts"],
  },
  {
    id: "html",
    name: "HTML",
    about: "Markup, forms and inputs, and accessibility.",
    words: ["html", "form", "forms", "input", "inputs", "semantic", "attribute", "attributes", "iframe", "accessibility", "aria", "a11y"],
  },
  {
    id: "css",
    name: "CSS",
    about: "Layout, centering, flexbox and grid, fonts, and responsive styles.",
    words: ["css", "center", "centre", "centering", "flexbox", "flex", "grid", "margin", "padding", "align", "font", "fonts", "selector", "selectors", "tailwind", "sass", "scss", "responsive", "animation", "layout"],
  },
  {
    id: "javascript",
    name: "JavaScript",
    about: "The language itself: arrays, objects, promises, events, and the DOM.",
    words: ["javascript", "js", "ecmascript", "array", "arrays", "object", "objects", "promise", "promises", "async", "await", "closure", "closures", "dom", "event", "events", "callback", "callbacks", "undefined"],
  },
  {
    id: "typescript",
    name: "TypeScript",
    about: "Types, interfaces, generics, and the compiler's settings.",
    words: ["typescript", "ts", "type", "types", "interface", "interfaces", "generic", "generics", "enum", "tsconfig"],
  },
  {
    id: "frameworks",
    name: "React and frameworks",
    about: "Components, hooks, props, and state, in React and its neighbours.",
    words: ["react", "jsx", "tsx", "component", "components", "hook", "hooks", "usestate", "useeffect", "props", "state", "vue", "svelte", "angular", "next", "nextjs", "nuxt", "astro", "redux"],
  },
  {
    id: "node",
    name: "Node and packages",
    about: "Runtimes, package managers, dependencies, and modules.",
    words: ["node", "nodejs", "npm", "bun", "pnpm", "yarn", "package", "packages", "dependency", "dependencies", "module", "modules", "import", "require", "express", "deno"],
  },
  {
    id: "python",
    name: "Python",
    about: "Lists, dictionaries, environments, and the libraries around them.",
    words: ["python", "pip", "venv", "virtualenv", "list", "lists", "dictionary", "dictionaries", "dict", "dicts", "tuple", "tuples", "pandas", "numpy", "django", "flask", "comprehension"],
  },
  {
    id: "sql",
    name: "Databases and SQL",
    about: "Queries, tables and joins, indexes, schemas, and migrations.",
    words: [
      "sql", "database", "databases", "query", "queries", "table", "tables", "join", "joins", "index", "indexes", "postgres", "postgresql", "mysql", "sqlite", "mongodb", "mongo", "redis",
      "schema", "migration", "migrations", "orm", "prisma",
    ],
  },
  {
    id: "http",
    name: "HTTP and APIs",
    about: "Requests and responses, REST, headers, cookies, tokens, and CORS.",
    words: [
      "http", "https", "api", "apis", "rest", "graphql", "fetch", "request", "requests", "response", "cors", "json", "endpoint", "endpoints", "header", "headers", "cookie", "cookies", "status",
      "webhook", "webhooks", "oauth", "token", "tokens", "curl", "axios", "websocket",
    ],
  },
  {
    id: "testing",
    name: "Testing and debugging",
    about: "Tests and mocks, errors and stack traces, logs, and linters.",
    words: ["test", "tests", "testing", "jest", "vitest", "pytest", "mock", "mocks", "debug", "debugging", "debugger", "error", "errors", "exception", "exceptions", "stack", "trace", "breakpoint", "log", "logs", "logging", "lint", "linter", "eslint"],
  },
  {
    id: "deploy",
    name: "Deploy and DevOps",
    about: "Servers, containers, pipelines, environments, and domains.",
    words: [
      "deploy", "deploying", "deployment", "docker", "dockerfile", "container", "containers", "kubernetes", "k8s", "ci", "pipeline", "nginx", "server", "servers", "aws", "vercel", "netlify",
      "cloudflare", "heroku", "env", "environment", "ssl", "domain", "dns",
    ],
  },
];

/** Each word, to the areas (by index on the path) whose list holds it. */
const AREAS_OF = new Map<string, number[]>();
AREAS.forEach((area, i) => {
  for (const word of area.words) AREAS_OF.set(word, [...(AREAS_OF.get(word) ?? []), i]);
});

/** Anything but a letter, a digit, # or +: what a skill name is split on. A fixed pattern, never built from text. */
const BETWEEN_WORDS = /[^\p{L}\p{N}#+]+/u;

/** Where a skill name goes: its area's index on the path, or null for elsewhere, and the words of its name that scored there, in the name's order. */
export function place(skill: string): { area: number | null; matched: string[] } {
  const words = [...new Set(skill.toLowerCase().split(BETWEEN_WORDS).filter(Boolean))];
  const scores = new Array<number>(AREAS.length).fill(0);
  for (const word of words) for (const i of AREAS_OF.get(word) ?? []) scores[i]!++;
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i]! > scores[best]!) best = i;
  if (scores[best] === 0) return { area: null, matched: [] };
  return { area: best, matched: words.filter((word) => AREAS_OF.get(word)?.includes(best)) };
}
