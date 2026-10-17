// Account: update the name and email, change the password (m1kuorg/basics#48),
// export all data, and delete the account (m1kuorg/basics#49). All of them
// need a session, not an API key.

import type { Account } from "./auth";
import type { Requester } from "./http";

/** The name, the email, or both. */
export type AccountChange = { name?: string; email?: string };

export type PasswordChange = {
  currentPassword: string;
  /** 10 to 200 characters. Changing it logs out every other session. */
  newPassword: string;
};

export const account = (request: Requester) => ({
  update: (change: AccountChange) => request<Account>("PATCH", "/account", change),
  changePassword: (change: PasswordChange) => request<void>("POST", "/account/password", change),
});
