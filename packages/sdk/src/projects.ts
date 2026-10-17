// Projects: list, create, get, rename, and delete (m1kuorg/basics#41).
// Deleting a project deletes everything in it, and needs a session, not an
// API key.

import { path, type Request } from "./http";

export type Project = {
  id: string;
  name: string;
  /** A demo project holds the demo export, labeled as demo data wherever it shows. */
  demo: boolean;
  createdAt: string;
  /** Its cards, and how many of them are borrowed, returned, and borrowed again. */
  counts: { cards: number; borrowed: number; returned: number; borrowedAgain: number };
  /** When its latest upload was made, or null before its first. */
  lastUploadAt: string | null;
};

export type NewProject = { name: string; demo?: boolean };

export const projects = (request: Request) => ({
  list: () => request<{ projects: Project[] }>("GET", "/projects").then((body) => body.projects),
  create: (input: NewProject) => request<Project>("POST", "/projects", input),
  get: (projectId: string) => request<Project>("GET", path`/projects/${projectId}`),
  rename: (projectId: string, name: string) => request<Project>("PATCH", path`/projects/${projectId}`, { name }),
  delete: (projectId: string) => request<void>("DELETE", path`/projects/${projectId}`),
});
