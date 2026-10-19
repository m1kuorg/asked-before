// Auth: sign up, log in, log out, and the current account
// (m1kuorg/basics#41). Signing up or logging in sets the session cookie, so
// these are for the page; scripts and agents use an API key instead. The
// password stays here: what's sent is the key derived from it and the
// email (password-key.ts, ADR 0006).

import type { Requester } from "./http.ts";
import { checkPassword, NEW_PASSWORD, passwordKey } from "./password-key.ts";

export type Account = { id: string; name: string; email: string; createdAt: string };

export type SignUp = {
  name: string;
  email: string;
  /** 10 to 200 characters. It never leaves your computer: the key derived from it is sent instead. */
  password: string;
  /** The app path to go back to afterwards. */
  next?: string;
};

export type LogIn = { email: string; password: string; next?: string };

/** What signing up or logging in returns: the account, and the app path to go to, which is `next` only when it's inside the app. */
export type Session = { account: Account; next: string };

export const auth = (request: Requester) => ({
  signUp: async ({ password, ...input }: SignUp) => {
    checkPassword(password, "A password", NEW_PASSWORD);
    return request<Session>("POST", "/auth/signup", { ...input, passwordKey: await passwordKey(password, input.email) });
  },
  logIn: async ({ password, ...input }: LogIn) => {
    checkPassword(password, "A password");
    return request<Session>("POST", "/auth/login", { ...input, passwordKey: await passwordKey(password, input.email) });
  },
  logOut: () => request<void>("POST", "/auth/logout"),
  me: () => request<Account>("GET", "/auth/me"),
});
