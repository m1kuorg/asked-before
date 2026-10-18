// The route table: every screen in the spec (m1kuorg/basics#40, Web app),
// each in its own module under src/screens/, owned by the ticket named
// there. Add a route only for a new screen; a screen's own views (such as a
// shelf's unsorted phrasings) can live in its query.

import { mountCard } from "../screens/card";
import { mountDesk } from "../screens/desk";
import { mountNotFound } from "../screens/not-found";
import { mountShelf } from "../screens/shelf";
import { mountShelves } from "../screens/shelves";
import { mountSettings } from "../screens/settings";
import { mountUpload } from "../screens/upload";
import { route } from "./router";

export const ROUTES = [
  route("desk", "/app/desk", "desk", "Desk", mountDesk),
  route("shelves", "/app/shelves", "shelves", "Shelves", mountShelves),
  route("shelf", "/app/shelves/:shelfId", "shelves", "Shelf", mountShelf),
  route("upload", "/app/shelves/:shelfId/upload", "shelves", "Upload a chat export", mountUpload),
  route("card", "/app/cards/:cardId", "shelves", "Card", mountCard),
  route("settings", "/app/settings", "settings", "Settings", mountSettings),
];

export const NOT_FOUND = route("not-found", "/app/*", null, "Page not found", mountNotFound);
