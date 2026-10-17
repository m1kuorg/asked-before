// Starts a copy of the app for a check script, on a free port with a fresh
// temporary database, and stops it again. Every check script that needs the
// app starts it through here (m1kuorg/basics#40, Operations).
//
//   const app = await startApp();
//   const ada = app.browser();            // keeps its own session cookie, like one browser
//   await ada.client.auth.signUp({ ... });
//   ...
//   await app.stop();

import { createClient, type Client } from "@asked-before/sdk";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

export type App = {
  /** The app's origin, as "http://localhost:51234". */
  url: string;
  /** The SQLite file this copy of the app uses. */
  databasePath: string;
  /** Everything the app has printed so far. */
  log: () => string;
  /** A client for one browser: it keeps the session cookie and sends the page's Origin, as the page's requests do. */
  browser: () => Browser;
  /** Stops the app and deletes its database. */
  stop: () => Promise<void>;
};

export type Browser = {
  client: Client;
  /** The Cookie header this browser sends, for requests made without the SDK. */
  cookie: () => string;
};

/** Starts the app. `env` adds to or overrides the environment, such as DAILY_MODEL_REQUESTS. */
export async function startApp(env: Record<string, string> = {}): Promise<App> {
  const dir = await mkdtemp(join(tmpdir(), "asked-before-check-"));
  const databasePath = join(dir, "app.sqlite");
  const proc = Bun.spawn(["bun", "server.ts"], {
    cwd: ROOT,
    // PUBLIC_URL is emptied so that a value in .env can't point the app's origin elsewhere.
    env: { ...process.env, PORT: "0", PUBLIC_URL: "", DATABASE_PATH: databasePath, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });

  let log = "";
  const collect = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) log += decoder.decode(chunk, { stream: true });
  };
  void collect(proc.stdout);
  void collect(proc.stderr);

  const deadline = Date.now() + 15_000;
  let match;
  while (!(match = log.match(/Asked Before is on (\S+)/))) {
    if (proc.exitCode !== null || Date.now() > deadline) {
      proc.kill();
      await rm(dir, { recursive: true, force: true });
      throw new Error(`The app didn't start:\n${log}`);
    }
    await Bun.sleep(25);
  }
  const url = new URL(match[1]!).origin;

  return {
    url,
    databasePath,
    log: () => log,
    browser: () => browser(url),
    stop: async () => {
      proc.kill();
      await proc.exited;
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/** A client for one browser on the app at `url`; check:container uses it on a container's app. */
export function browser(url: string): Browser {
  const jar = new Map<string, string>();
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  const send = async (input: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    headers.set("origin", url);
    if (jar.size) headers.set("cookie", cookie());
    const response = await fetch(input, { ...init, headers });
    for (const line of response.headers.getSetCookie()) {
      const set = Bun.Cookie.parse(line);
      if (set.value === "" || set.isExpired()) jar.delete(set.name);
      else jar.set(set.name, set.value);
    }
    return response;
  };
  return { client: createClient({ baseUrl: url, fetch: send }), cookie };
}
