// The docs page (/docs): how to reach your cards from your own scripts and
// agents (brief sections 5 and 7), in read mode (read-mode/page.tsx): the
// h1 and its lede, the API's address, then the six sections beside their
// index, and under the index a link to the privacy page.
import { createRoot } from "react-dom/client";
import { SECTIONS } from "./docs/sections";
import { ReadPage } from "./read-mode/page";
import { C } from "./read-mode/prose";

createRoot(document.getElementById("app")!).render(
  <ReadPage
    title="Docs"
    lede="How to reach your cards from your own scripts and agents: the API, the SDK, the MCP server, and the Claude Code plugin."
    intro={
      <p>
        Every endpoint here is under <C>{`${location.origin}/api/v1`}</C>, this server's API.
      </p>
    }
    sections={SECTIONS}
    other={{ href: "/privacy", label: "Privacy" }}
  />,
);
