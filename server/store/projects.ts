// Projects, each with its card counts by status (from the card_status view)
// and its last upload time. Every query is scoped by the owner, so another
// account's project reads as missing.

import type { Project } from "@asked-before/sdk";
import { db, iso, newId } from "./db";

type Row = {
  id: string;
  name: string;
  demo: 0 | 1;
  created_at: number;
  cards: number;
  borrowed: number;
  returned: number;
  borrowed_again: number;
  last_upload_at: number | null;
};

const SELECT = `
  SELECT
    p.id, p.name, p.demo, p.created_at,
    count(s.card_id) AS cards,
    coalesce(sum(s.status = 'borrowed'), 0) AS borrowed,
    coalesce(sum(s.status = 'returned'), 0) AS returned,
    coalesce(sum(s.status = 'borrowed_again'), 0) AS borrowed_again,
    (SELECT max(u.created_at) FROM uploads u WHERE u.project_id = p.id) AS last_upload_at
  FROM projects p
  LEFT JOIN card_status s ON s.project_id = p.id`;

const toProject = (row: Row): Project => ({
  id: row.id,
  name: row.name,
  demo: row.demo === 1,
  createdAt: iso(row.created_at),
  counts: { cards: row.cards, borrowed: row.borrowed, returned: row.returned, borrowedAgain: row.borrowed_again },
  lastUploadAt: row.last_upload_at === null ? null : iso(row.last_upload_at),
});

/** The account's projects, oldest first. */
export function listProjects(userId: string): Project[] {
  const rows = db.query(`${SELECT} WHERE p.user_id = $userId GROUP BY p.id ORDER BY p.created_at, p.id`).all({ userId }) as Row[];
  return rows.map(toProject);
}

export function getProject(userId: string, projectId: string): Project | null {
  const row = db
    .query(`${SELECT} WHERE p.user_id = $userId AND p.id = $projectId GROUP BY p.id`)
    .get({ userId, projectId }) as Row | null;
  return row && toProject(row);
}

export function createProject(userId: string, name: string, demo: boolean): Project {
  const id = newId();
  db.query("INSERT INTO projects (id, user_id, name, demo, created_at) VALUES ($id, $userId, $name, $demo, $now)").run({
    id,
    userId,
    name,
    demo: demo ? 1 : 0,
    now: Date.now(),
  });
  return getProject(userId, id)!;
}

/** The renamed project, or null when the account has no such project. */
export function renameProject(userId: string, projectId: string, name: string): Project | null {
  db.query("UPDATE projects SET name = $name WHERE id = $projectId AND user_id = $userId").run({ userId, projectId, name });
  return getProject(userId, projectId);
}

/** Deletes the project and, by cascade, everything in it. False when the account has no such project. */
export function deleteProject(userId: string, projectId: string): boolean {
  return db.query("DELETE FROM projects WHERE id = $projectId AND user_id = $userId").run({ userId, projectId }).changes > 0;
}
