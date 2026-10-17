// Settings (m1kuorg/basics#48), from the shared parts (src/parts/): the
// profile (name and email), the password (the current one first; changing it
// logs out every other browser), API keys (made and shown once, listed with
// their prefix and their made and last-used dates, revoked after a
// confirmation), and the setup snippets that connect an agent, with this
// server's address filled in. Then your data (m1kuorg/basics#49): all of it
// downloaded as one JSON file, and deleting the account, which takes the
// password and then a confirmation, and logs out to the landing page.

import type { Account, AccountData, ApiKey, CreatedApiKey } from "@asked-before/sdk";
import { connectSnippets, PLACEHOLDERS } from "../../packages/mcp/src/connect";
import type { ScreenProps } from "../app/router";
import { codeBlock } from "../parts/code-block";
import { confirmDelete } from "../parts/confirm";
import { button, el, type Child } from "../parts/dom";
import { emptyState } from "../parts/empty";
import { field, form } from "../parts/fields";
import { frame, load } from "../parts/frame";
import { stamp } from "../parts/library";
import { rows } from "../parts/rows";

export function mountSettings(root: HTMLElement, props: ScreenProps) {
  const { block } = frame(root, [
    el("p", undefined, "Your name shows in the navigation, and your email is how you log in."),
    el("p", undefined, "An API key lets a script or an agent reach your projects without your password. Make one for each, so you can revoke one alone."),
    el("p", undefined, "Your data is yours: download all of it, or delete your account and leave nothing behind."),
  ]);
  const loggedIn = el("p", undefined, loggedInAs(props.account));
  block.append(
    el("h1", undefined, "Settings"),
    loggedIn,
    profile(props, (account) => (loggedIn.textContent = loggedInAs(account))),
    password(props),
    apiKeys(props),
    agents(location.origin),
    yourData(props),
    deleteAccount(props),
  );
}

const loggedInAs = (account: Account) => `Logged in as ${account.name}, ${account.email}.`;

/** A section of the page: a heading over its parts. */
const section = (title: string, ...children: Child[]) => el("section", "settings-section", el("h2", undefined, title), ...children);

/** Says a form went through, above its button, until it's sent again. */
function saved(target: HTMLFormElement, message: string) {
  target.querySelector(".saved")?.remove();
  const line = el("p", "saved", message);
  line.setAttribute("role", "status");
  target.querySelector("button[type=submit]")!.before(line);
}

function profile({ client, account, setAccount }: ScreenProps, onSaved: (account: Account) => void) {
  const name = field({ label: "Name", name: "name", value: account.name, autocomplete: "name" });
  const email = field({ label: "Email", name: "email", type: "email", value: account.email, autocomplete: "email" });
  const sent = form({
    fields: [name.element, email.element],
    submit: "Save profile",
    onSubmit: async (target) => {
      target.querySelector(".saved")?.remove();
      const updated = await client.account.update({ name: name.input.value, email: email.input.value });
      name.input.value = updated.name;
      email.input.value = updated.email;
      setAccount(updated);
      onSaved(updated);
      saved(target, "Your profile is saved.");
    },
  });
  return section("Profile", sent);
}

function password({ client }: ScreenProps) {
  const current = field({ label: "Current password", name: "currentPassword", type: "password", autocomplete: "current-password" });
  const next = field({
    label: "New password",
    name: "newPassword",
    type: "password",
    autocomplete: "new-password",
    hint: "10 to 200 characters. Changing it logs out every other browser.",
  });
  const sent = form({
    fields: [current.element, next.element],
    submit: "Change password",
    onSubmit: async (target) => {
      target.querySelector(".saved")?.remove();
      await client.account.changePassword({ currentPassword: current.input.value, newPassword: next.input.value });
      current.input.value = next.input.value = "";
      saved(target, "Your password is changed, and every other browser is logged out.");
    },
  });
  return section("Password", sent);
}

function apiKeys({ client, signal }: ScreenProps) {
  const list = el("div", "key-list");
  let keys: ApiKey[] = [];
  /** The key just made, shown under its row until the learner leaves, and the key whose revoke is being confirmed. */
  let made: CreatedApiKey | null = null;
  let revoking: string | null = null;

  const name = field({ label: "Key name", name: "name", placeholder: "Such as Laptop or Claude Code", autocomplete: "off" });
  const create = form({
    fields: [name.element],
    submit: "Create key",
    layout: "row",
    className: "new-key",
    onSubmit: async () => {
      made = await client.keys.create({ name: name.input.value });
      const { key: _shownOnce, ...listed } = made;
      keys = [...keys, listed];
      revoking = null;
      name.input.value = "";
      draw(() => list.querySelector<HTMLElement>(".key-shown button"));
    },
  });

  load(list, {
    line: "Finding your API keys…",
    request: () => client.keys.list(),
    signal,
    show: (listed) => {
      keys = listed;
      draw();
    },
  });

  function draw(focus?: () => HTMLElement | null) {
    list.replaceChildren(
      keys.length
        ? rowsOfKeys()
        : emptyState("No API keys yet", "Make one below for a script or an agent. It's shown once, when you make it."),
    );
    focus?.()?.focus();
  }

  function rowsOfKeys() {
    return rows({
      caption: "Your API keys",
      items: keys,
      columns: [
        { label: "Name", cell: (key) => el("span", "row-title", key.name) },
        { label: "Prefix", className: "is-prefix", cell: (key) => key.prefix },
        { label: "Made", numeric: true, className: "is-date", cell: (key) => stamp(key.createdAt) },
        { label: "Last used", numeric: true, className: "is-date", cell: (key) => (key.lastUsedAt ? stamp(key.lastUsedAt) : "Never") },
        { label: "Actions", hiddenLabel: true, className: "is-actions", cell: revokeButton },
      ],
      detail: (key) => (key.id === revoking ? confirmation(key) : key.id === made?.id ? shown(made) : null),
    });
  }

  function revokeButton(key: ApiKey) {
    const revoke = button("Revoke", () => {
      revoking = revoking === key.id ? null : key.id;
      draw(revoking ? undefined : () => revokeOf(key));
    }, "quiet");
    revoke.setAttribute("aria-label", `Revoke ${key.name}`);
    revoke.setAttribute("aria-expanded", String(revoking === key.id));
    return revoke;
  }

  function shown(key: CreatedApiKey) {
    const code = codeBlock(`${key.name}'s key`, key.key);
    code.querySelector("button")!.setAttribute("aria-label", `Copy ${key.name}'s key`);
    return el("div", "key-shown", el("p", undefined, "Copy this key now: it's shown only this once. Anything that has it can reach your projects."), code);
  }

  function confirmation(key: ApiKey) {
    return confirmDelete({
      title: `Revoke ${key.name}?`,
      body: "Anything that uses this key loses access to your projects at once. It can't be undone.",
      action: `Revoke ${key.name}`,
      onConfirm: async () => {
        await client.keys.revoke(key.id);
        keys = keys.filter((k) => k.id !== key.id);
        if (made?.id === key.id) made = null;
        revoking = null;
        draw(() => name.input);
      },
      onCancel: () => {
        revoking = null;
        draw(() => revokeOf(key));
      },
    });
  }

  const revokeOf = (key: ApiKey) =>
    [...list.querySelectorAll<HTMLElement>("button[aria-label^='Revoke']")].find((b) => b.getAttribute("aria-label") === `Revoke ${key.name}`) ?? null;

  return section(
    "API keys",
    el("p", undefined, "A key can read your projects and add to them, but it can't delete anything, export your data, manage keys, or change your account."),
    list,
    create,
  );
}

function agents(serverUrl: string) {
  const snippets = connectSnippets(serverUrl);
  const whichBun = `For ${PLACEHOLDERS.bun}, put the path that the command "which bun" prints.`;
  return section(
    "Connect an agent",
    el(
      "p",
      undefined,
      "Asked Before's MCP server lets Claude Code, Claude Desktop, or Cursor record the questions you ask there and run cold reps in chat. It runs on your computer from a copy of Asked Before: clone it and run bun install, then add the server to your agent.",
    ),
    el("p", undefined, `In each snippet, put your copy's folder for ${PLACEHOLDERS.clone}, and a key from above for ${PLACEHOLDERS.apiKey}.`),
    codeBlock("Claude Code", snippets.claudeCode),
    el("p", undefined, "Run it in a terminal."),
    codeBlock("Claude Desktop", snippets.claudeDesktop),
    el("p", undefined, `In Claude Desktop, open Settings, then Developer, then Edit Config, and add it to claude_desktop_config.json. ${whichBun} Then restart Claude Desktop.`),
    codeBlock("Cursor", snippets.cursor),
    el("p", undefined, `Add it to ~/.cursor/mcp.json, or to .cursor/mcp.json for one project. ${whichBun}`),
  );
}

function yourData({ client }: ScreenProps) {
  const sent = form({
    fields: [],
    submit: "Download your data",
    onSubmit: async (target) => {
      target.querySelector(".saved")?.remove();
      saved(target, `Downloaded ${download(await client.account.export())}.`);
    },
  });
  return section(
    "Your data",
    el(
      "p",
      undefined,
      "Download everything Asked Before keeps for you as one JSON file: your account, your projects and their uploads, every phrasing, and your cards with their lessons and cold reps. Your API keys and password aren't in it.",
    ),
    sent,
  );
}

/** Saves the data as a JSON file named for today, in the learner's own time zone, and returns its name. */
function download(data: AccountData): string {
  const name = `asked-before-${stamp(data.exportedAt).textContent}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const save = el("a");
  save.href = url;
  save.download = name;
  save.click();
  // The browser has the file once the download starts; the URL is let go well after.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return name;
}

/**
 * The password, then the delete confirmation under it. The form stays
 * locked while the confirmation asks: Keep it (or Escape) goes back to the
 * password, and a refused delete shows on the form, marking the password.
 */
function deleteAccount({ client }: ScreenProps) {
  const password = field({ label: "Your password", name: "password", type: "password", autocomplete: "current-password" });
  const sent = form({
    fields: [password.element],
    submit: "Delete your account",
    onSubmit: (target) =>
      new Promise<void>((resolve, reject) => {
        const confirmation = confirmDelete({
          title: "Delete your account and everything in it?",
          body: "Your projects, their uploads and phrasings, your cards with their lessons and cold reps, and your API keys all go, and every browser is logged out. It can't be undone.",
          action: "Delete everything",
          onConfirm: async () => {
            try {
              await client.account.delete({ password: password.input.value });
            } catch (error) {
              confirmation.remove();
              reject(error);
              return;
            }
            location.assign("/");
          },
          onCancel: () => {
            confirmation.remove();
            resolve();
            password.input.focus();
          },
        });
        target.after(confirmation);
      }),
  });
  return section(
    "Delete your account",
    el("p", undefined, "Deleting your account deletes everything Asked Before keeps for you. It can't be undone, so download your data first if you want to keep it."),
    sent,
  );
}
