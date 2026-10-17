// Auth: sign up, log in, log out, and the current account
// (m1kuorg/basics#41). Signing up or logging in sets the session cookie, so
// these are for the page; scripts and agents use an API key instead.

import type { Request } from "./http";

export type Account = { id: string; name: string; email: string; createdAt: string };

export type SignUp = {
  name: string;
  email: string;
  /** 10 to 200 characters. */
  password: string;
  /** The app path to go back to afterwards. */
  next?: string;
};

export type LogIn = { email: string; password: string; next?: string };

/** What signing up or logging in returns: the account, and the app path to go to, which is `next` only when it's inside the app. */
export type Session = { account: Account; next: string };

export const auth = (request: Request) => ({
  signUp: (input: SignUp) => request<Session>("POST", "/auth/signup", input),
  logIn: (input: LogIn) => request<Session>("POST", "/auth/login", input),
  logOut: () => request<void>("POST", "/auth/logout"),
  me: () => request<Account>("GET", "/auth/me"),
});
