// Account: update the name and email, change the password (m1kuorg/basics#48),
// download all your data, and delete the account (m1kuorg/basics#49). All of
// them need a session, not an API key. A password stays here: what's sent is
// the key derived from it and the account's email (password-key.ts, ADR
// 0006), which these methods read first with auth.me. A new email changes
// the key's salt, so changing the email needs the password too.

import type { Account } from "./auth.ts";
import type { Card, StoredPhrasing } from "./cards.ts";
import { ApiError, type Requester } from "./http.ts";
import { checkPassword, NEW_PASSWORD, passwordKey } from "./password-key.ts";
import type { Shelf } from "./shelves.ts";
import type { Rep } from "./reps.ts";
import type { Upload } from "./uploads.ts";

/** The name, the email, or both. */
export type AccountChange = {
  name?: string;
  email?: string;
  /** Needed with a new email, since the key derived from the password changes with it. */
  password?: string;
};

export type PasswordChange = {
  currentPassword: string;
  /** 10 to 200 characters. Changing it logs out every other session. */
  newPassword: string;
};

/** One of your phrasings, with where it came from and the card it's on. */
export type PhrasingData = StoredPhrasing & {
  /** Read from a chat export, or recorded by an agent as a capture. */
  origin: "export" | "capture";
  /** The upload that brought it, or null for a capture. */
  uploadId: string | null;
  /** The card it's on, or null while it's unsorted or waiting for its sort. */
  cardId: string | null;
};

/** A card as `cards.list` shows it, with its lesson and its cold reps, oldest first. Its borrows are the phrasings whose `cardId` is its id. */
export type CardData = Card & { lesson: string | null; reps: Rep[] };

/** A shelf as `shelves.list` shows it, with everything in it. */
export type ShelfData = Shelf & {
  /** Its uploads, oldest first. */
  uploads: Upload[];
  /** Every phrasing in it, oldest first: on a card, unsorted, or waiting for its sort. */
  phrasings: PhrasingData[];
  /** Its cards, most borrowed first, as the stack sets them. */
  cards: CardData[];
};

/** Everything Asked Before keeps for you: the account and every shelf, oldest first. API keys and the password aren't in it. */
export type AccountData = { exportedAt: string; account: Account; shelves: ShelfData[] };

/** Deleting the account needs its password. */
export type AccountDeletion = { password: string };

export const account = (request: Requester) => {
  /** The account's email, the salt of its password's key. */
  const email = async () => (await request<Account>("GET", "/auth/me")).email;
  return {
    /** Changes the name, the email, or both. A new email needs the password; a wrong one is a 403. */
    update: async ({ password, ...change }: AccountChange) => {
      if (change.email === undefined) return request<Account>("PATCH", "/account", change);
      if (!password) throw new ApiError(400, "Changing the email needs your password.");
      checkPassword(password, "Your password");
      const currentPasswordKey = await passwordKey(password, await email());
      const newPasswordKey = await passwordKey(password, change.email);
      return request<Account>("PATCH", "/account", { ...change, currentPasswordKey, newPasswordKey });
    },
    changePassword: async ({ currentPassword, newPassword }: PasswordChange) => {
      checkPassword(currentPassword, "Your current password");
      checkPassword(newPassword, "A new password", NEW_PASSWORD);
      const salt = await email();
      const currentPasswordKey = await passwordKey(currentPassword, salt);
      const newPasswordKey = await passwordKey(newPassword, salt);
      return request<void>("POST", "/account/password", { currentPasswordKey, newPasswordKey });
    },
    /** All your data, as one JSON value. */
    export: () => request<AccountData>("GET", "/account/export"),
    /** Deletes the account and everything in it, and ends every session; a wrong password is a 403. */
    delete: async ({ password }: AccountDeletion) => {
      checkPassword(password, "Your password", 1);
      return request<void>("DELETE", "/account", { passwordKey: await passwordKey(password, await email()) });
    },
  };
};
