// Captures: record one phrasing into a project as you ask it, and sort it
// at once (m1kuorg/basics#50). An agent sends only your own words; the
// server stamps the time. The answer says the card it landed on, with its
// count and status, or that nothing asks the same thing yet and it waits
// unsorted. The same words in the same project within ten minutes return
// that earlier capture instead of adding a borrow.

import type { Borrow, Card } from "./cards";
import { path, type Requester } from "./http";

/** Your own question, word for word, of at most 2,000 characters. Its time is the server's clock. */
export type NewCapture = { text: string };

export type Capture = {
  /** The phrasing recorded, with its generated source id and the time the server stamped. */
  phrasing: Borrow;
  /** The card it landed on, as it stands now, or null while it's unsorted. */
  card: Card | null;
  /** True when the same words were captured in this project in the last ten minutes: this is that capture, and no borrow was added. */
  repeat: boolean;
};

export const captures = (request: Requester) => ({
  /** Records `text` into the project and sorts it at once. */
  create: (projectId: string, input: NewCapture) => request<Capture>("POST", path`/projects/${projectId}/captures`, input),
});
