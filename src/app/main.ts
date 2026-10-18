// The app's page entry, served at every path under /app/. It asks who
// is logged in (a 401 goes to log in and back), draws the top navigation,
// and hands every app path to the router.

import { failure } from "../parts/frame";
import { client } from "./client";
import { mountNav } from "./nav";
import { startRouter } from "./router";
import { NOT_FOUND, ROUTES } from "./routes";

const root = document.querySelector<HTMLElement>("#app")!;

async function start() {
  let account;
  try {
    account = await client.auth.me();
  } catch (error) {
    root.replaceChildren(...failure(error, () => location.reload()));
    return;
  }
  const nav = mountNav(root, account);
  startRouter({ root, routes: ROUTES, notFound: NOT_FOUND, client, account, onShow: nav.setCurrent, onAccount: nav.setAccount });
}

void start();
