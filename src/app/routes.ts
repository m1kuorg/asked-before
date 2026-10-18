// The route table: every screen in the spec (m1kuorg/basics#40, Web app),
// each in its own module under src/screens/, owned by the ticket named
// there. Add a route only for a new screen; a screen's own views (such as a
// project's unsorted phrasings) can live in its query.

import { mountCard } from "../screens/card";
import { mountDashboard } from "../screens/dashboard";
import { mountNotFound } from "../screens/not-found";
import { mountProject } from "../screens/project";
import { mountProjects } from "../screens/projects";
import { mountSettings } from "../screens/settings";
import { mountUpload } from "../screens/upload";
import { route } from "./router";

export const ROUTES = [
  route("dashboard", "/app", "dashboard", "Dashboard", mountDashboard),
  route("projects", "/app/projects", "projects", "Projects", mountProjects),
  route("project", "/app/projects/:projectId", "projects", "Project", mountProject),
  route("upload", "/app/projects/:projectId/upload", "projects", "Upload a chat export", mountUpload),
  route("card", "/app/cards/:cardId", "projects", "Card", mountCard),
  route("settings", "/app/settings", "settings", "Settings", mountSettings),
];

export const NOT_FOUND = route("not-found", "/app/*", null, "Page not found", mountNotFound);
