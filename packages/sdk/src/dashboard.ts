// Dashboard: the cross-project summary (m1kuorg/basics#47). What's still
// borrowed across your projects, most borrowed first; your latest borrows
// and returns; and the totals of your cards by status, which add up the
// projects' own counts. Plain numbers and lists only: no charts, streaks,
// or scores.

import type { Borrow, Card, CardStatus } from "./cards.ts";
import type { Requester } from "./http.ts";
import type { Project } from "./projects.ts";

/** The project a card or borrow is in. A demo project is labeled as demo data wherever it shows. */
export type DashboardProject = Pick<Project, "id" | "name" | "demo">;

/** A card, with the project it's in. */
export type DashboardCard = Card & { project: DashboardProject };

/** A borrow, with the card it's on and that card's project. */
export type DashboardBorrow = Borrow & { card: { id: string; skill: string; status: CardStatus }; project: DashboardProject };

export type Dashboard = {
  /** How many projects you have. */
  projects: number;
  /** Your cards across every project, and how many are borrowed, returned, and borrowed again: the sums of the projects' own counts. */
  totals: Project["counts"];
  /** Up to 10 cards no cold rep has returned (borrowed, or borrowed again), across projects, most borrowed first, ties to the later last borrow. */
  mostBorrowed: DashboardCard[];
  /** Your 10 latest borrows across projects, by when you sent them, newest first. */
  latestBorrows: DashboardBorrow[];
  /** Up to 10 cards with a return stamp, latest stamp first. A card borrowed again since keeps its stamp and says so in its status. */
  latestReturns: DashboardCard[];
};

export const dashboard = (request: Requester) => ({
  get: () => request<Dashboard>("GET", "/dashboard"),
});
