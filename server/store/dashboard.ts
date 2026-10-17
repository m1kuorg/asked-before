// The dashboard, as the store reads it (m1kuorg/basics#47): one account's
// cards across all its projects. Every count, stamp, and status comes from
// the card_status view, as the projects' own counts do, so the totals add
// up to theirs. Every query is scoped by the owner.

import type { Dashboard, DashboardBorrow, DashboardCard, DashboardProject } from "@asked-before/sdk";
import { toCard, type CardRow } from "./cards";
import { db, iso } from "./db";

/** How many items each of the dashboard's lists holds at most. */
const LIST = 10;

type ProjectColumns = { project_name: string; project_demo: 0 | 1 };

const projectOf = (row: { project_id: string } & ProjectColumns): DashboardProject => ({ id: row.project_id, name: row.project_name, demo: row.project_demo === 1 });

const CARDS = `
  SELECT c.id, c.project_id, c.skill, c.lesson, s.status, s.borrows, s.first_borrow_at, s.last_borrow_at, s.returned_at,
    p.name AS project_name, p.demo AS project_demo
  FROM cards c
  JOIN card_status s ON s.card_id = c.id
  JOIN projects p ON p.id = c.project_id
  WHERE p.user_id = $userId`;

const toDashboardCard = (row: CardRow & ProjectColumns): DashboardCard => ({ ...toCard(row), project: projectOf(row) });

type BorrowRow = {
  id: string;
  source_id: string;
  text: string;
  time: number;
  card_id: string;
  skill: string;
  status: DashboardBorrow["card"]["status"];
  project_id: string;
} & ProjectColumns;

export function getDashboard(userId: string): Dashboard {
  const { projects } = db.query("SELECT count(*) AS projects FROM projects WHERE user_id = $userId").get({ userId }) as { projects: number };
  const totals = db
    .query(
      `SELECT
         count(*) AS cards,
         coalesce(sum(s.status = 'borrowed'), 0) AS borrowed,
         coalesce(sum(s.status = 'returned'), 0) AS returned,
         coalesce(sum(s.status = 'borrowed_again'), 0) AS borrowedAgain
       FROM card_status s JOIN projects p ON p.id = s.project_id
       WHERE p.user_id = $userId`,
    )
    .get({ userId }) as Dashboard["totals"];

  const mostBorrowed = db
    .query(`${CARDS} AND s.status <> 'returned' ORDER BY s.borrows DESC, s.last_borrow_at DESC, c.id LIMIT ${LIST}`)
    .all({ userId }) as (CardRow & ProjectColumns)[];

  const latestReturns = db
    .query(`${CARDS} AND s.returned_at IS NOT NULL ORDER BY s.returned_at DESC, c.id DESC LIMIT ${LIST}`)
    .all({ userId }) as (CardRow & ProjectColumns)[];

  const latestBorrows = db
    .query(
      `SELECT f.id, f.source_id, f.text, f.time, c.id AS card_id, c.skill, s.status,
         p.id AS project_id, p.name AS project_name, p.demo AS project_demo
       FROM phrasings f
       JOIN cards c ON c.id = f.card_id
       JOIN card_status s ON s.card_id = c.id
       JOIN projects p ON p.id = c.project_id
       WHERE p.user_id = $userId
       ORDER BY f.time DESC, f.id DESC LIMIT ${LIST}`,
    )
    .all({ userId }) as BorrowRow[];

  return {
    projects,
    totals,
    mostBorrowed: mostBorrowed.map(toDashboardCard),
    latestBorrows: latestBorrows.map(
      (row): DashboardBorrow => ({
        id: row.id,
        sourceId: row.source_id,
        text: row.text,
        time: iso(row.time),
        card: { id: row.card_id, skill: row.skill, status: row.status },
        project: projectOf(row),
      }),
    ),
    latestReturns: latestReturns.map(toDashboardCard),
  };
}
