// Account: update the name and email, change the password (m1kuorg/basics#48),
// download all your data, and delete the account (m1kuorg/basics#49). All of
// them need a session, not an API key.

import type { Account } from "./auth.ts";
import type { Card, StoredPhrasing } from "./cards.ts";
import type { Requester } from "./http.ts";
import type { Shelf } from "./shelves.ts";
import type { Rep } from "./reps.ts";
import type { Upload } from "./uploads.ts";

/** The name, the email, or both. */
export type AccountChange = { name?: string; email?: string };

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

export const account = (request: Requester) => ({
  update: (change: AccountChange) => request<Account>("PATCH", "/account", change),
  changePassword: (change: PasswordChange) => request<void>("POST", "/account/password", change),
  /** All your data, as one JSON value. */
  export: () => request<AccountData>("GET", "/account/export"),
  /** Deletes the account and everything in it, and ends every session; a wrong password is a 403. */
  delete: (deletion: AccountDeletion) => request<void>("DELETE", "/account", deletion),
});
