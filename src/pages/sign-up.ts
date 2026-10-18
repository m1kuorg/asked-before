// The sign-up page. A weak password or an email already in use gets the
// server's message; signing up goes to `next`, or to the dashboard.

import { field, form } from "../parts/fields";
import { client, mountAccountPage, next } from "./account";

const name = field({ label: "Name", name: "name", autocomplete: "name" });
const email = field({ label: "Email", name: "email", type: "email", autocomplete: "email" });
const password = field({ label: "Password", name: "password", type: "password", autocomplete: "new-password", hint: "At least 10 characters." });

mountAccountPage({
  title: "Sign up",
  note: "An account keeps your projects, their cards, and every return stamp, from one visit to the next.",
  form: form({
    fields: [name.element, email.element, password.element],
    submit: "Sign up",
    onSubmit: async () => {
      const session = await client.auth.signUp({ name: name.input.value, email: email.input.value, password: password.input.value, next });
      location.assign(session.next);
    },
  }),
  other: { heading: "Already signed up?", body: "Log in with your email and your password.", action: "Log in", href: "/login" },
});
