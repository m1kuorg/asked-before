// Projects: list, create, get, rename, and delete (m1kuorg/basics#41).
// Another account's project is a 404. Renaming or deleting one needs a
// session: an API key only reads projects and makes them.

import type { Project } from "@asked-before/sdk";
import { z } from "zod";
import { authed } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { createProject, deleteProject, getProject, listProjects, renameProject } from "../store/projects";

const ProjectName = z
  .string({ error: "A project needs a name." })
  .trim()
  .min(1, "A project needs a name.")
  .max(80, "A project name can have at most 80 characters.");

const NewProject = z.strictObject({ name: ProjectName, demo: z.boolean({ error: "demo is true or false." }).optional() });
const Rename = z.strictObject({ name: ProjectName });

const found = (project: Project | null): Project => {
  if (!project) throw new HttpError(404, "There's no such project.");
  return project;
};

export const projects = defineRoutes({
  "/api/v1/projects": {
    GET: authed((_req, auth) => Response.json({ projects: listProjects(auth.userId) })),
    POST: authed(async (req, auth) => {
      const { name, demo = false } = await readJson(req, NewProject);
      return Response.json(createProject(auth.userId, name, demo), { status: 201 });
    }),
  },

  "/api/v1/projects/:projectId": {
    GET: authed((req, auth) => Response.json(found(getProject(auth.userId, req.params.projectId)))),
    PATCH: authed(
      async (req, auth) => {
        const { name } = await readJson(req, Rename);
        return Response.json(found(renameProject(auth.userId, req.params.projectId, name)));
      },
      { sessionOnly: true },
    ),
    DELETE: authed(
      (req, auth) => {
        if (!deleteProject(auth.userId, req.params.projectId)) throw new HttpError(404, "There's no such project.");
        return new Response(null, { status: 204 });
      },
      { sessionOnly: true },
    ),
  },
});
