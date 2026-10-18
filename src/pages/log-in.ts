// The log-in page. A wrong email or password gets the server's one message
// for both; logging in goes back to `next`, or to the Desk.

import { field, form } from "../parts/fields";
import { client, mountAccountPage, next } from "./account";

const email = field({ label: "Email", name: "email", type: "email", autocomplete: "email" });
const password = field({ label: "Password", name: "password", type: "password", autocomplete: "current-password" });

mountAccountPage({
  title: "Log in",
  note: "Once you log in, this browser stays logged in for 30 days, or until you log out.",
  form: form({
    fields: [email.element, password.element],
    submit: "Log in",
    onSubmit: async () => {
      const session = await client.auth.logIn({ email: email.input.value, password: password.input.value, next });
      location.assign(session.next);
    },
  }),
  other: { heading: "New to Asked Before?", body: "Sign up with your name, your email, and a password.", action: "Sign up", href: "/signup" },
});
