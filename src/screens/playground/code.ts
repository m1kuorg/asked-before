// The request as code, rebuilt from the inputs on every change: curl, the
// TypeScript SDK (the endpoint's own method, such as client.shelves.list()),
// and fetch. Every one sends YOUR_API_KEY as a Bearer token (PLACEHOLDERS in
// packages/mcp/src/connect.ts): a pasted key is never printed here, and a
// session's cookie is HttpOnly, so it can't be copied out of the browser. An
// id not yet filled stays as its :param, as in the address.

import { PLACEHOLDERS } from "../../../packages/mcp/src/connect";
import type { Entry } from "./endpoints";
import type { Built } from "./request";

const KEY = PLACEHOLDERS.apiKey;

/** A value as a JavaScript literal: keys unquoted where they can be, on one line when it's short. */
export function literal(value: unknown, indent = ""): string {
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    const inner = `${indent}  `;
    return `[\n${value.map((item) => inner + literal(item, inner)).join(",\n")},\n${indent}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    const name = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key));
    const flat = `{ ${entries.map(([key, item]) => `${name(key)}: ${literal(item)}`).join(", ")} }`;
    if (flat.length <= 60 && !flat.includes("\n")) return flat;
    const inner = `${indent}  `;
    return `{\n${entries.map(([key, item]) => `${inner}${name(key)}: ${literal(item, inner)}`).join(",\n")},\n${indent}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

/** A shell argument in single quotes. */
const quoted = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`;

export function curl(origin: string, built: Built): string {
  const lines = [`curl${built.method === "GET" ? "" : ` -X ${built.method}`} ${quoted(origin + built.url)}`, `  -H ${quoted(`authorization: Bearer ${KEY}`)}`];
  if (built.body !== undefined) lines.push(`  -H ${quoted("content-type: application/json")}`, `  -d ${quoted(built.body)}`);
  return lines.join(" \\\n");
}

export function fetchCode(origin: string, built: Built): string {
  const headers = [`    authorization: "Bearer ${KEY}",`];
  if (built.body !== undefined) headers.push(`    "content-type": "application/json",`);
  const init = [...(built.method === "GET" ? [] : [`  method: "${built.method}",`]), "  headers: {", ...headers, "  },"];
  if (built.body !== undefined) init.push(`  body: ${built.parsed === undefined ? JSON.stringify(built.body) : `JSON.stringify(${literal(built.parsed, "  ")})`},`);
  return [`const response = await fetch(${JSON.stringify(origin + built.url)}, {`, ...init, "});", "console.log(response.status, await response.text());"].join("\n");
}

export function sdkCode(origin: string, built: Built, entry: Entry, ids: Partial<Record<string, string>>): string {
  const args: string[] = entry.params.map((param) => JSON.stringify(ids[param]?.trim() || `:${param}`));
  if (entry.paged && (built.page.limit || built.page.cursor)) {
    const page: Record<string, unknown> = {};
    if (built.page.limit) page.limit = /^\d+$/.test(built.page.limit) ? Number(built.page.limit) : built.page.limit;
    if (built.page.cursor) page.cursor = built.page.cursor;
    args.push(literal(page));
  }
  if (built.body !== undefined && !entry.noBody) {
    if (built.parsed === undefined) args.push(built.body);
    else if (entry.sdkArg && built.parsed !== null && typeof built.parsed === "object") args.push(literal(entry.sdkArg(built.parsed as Record<string, unknown>)));
    else args.push(literal(built.parsed));
  }
  const call = `client.${entry.sdk}(${args.join(", ")})`;
  // A 204 resolves to undefined: nothing to print.
  const line = entry.method === "DELETE" || entry.id === "POST /auth/logout" ? `await ${call};` : `console.log(await ${call});`;
  return [`import { createClient } from "@asked-before/sdk";`, "", `const client = createClient({ baseUrl: ${JSON.stringify(origin)}, apiKey: "${KEY}" });`, line].join("\n");
}
