// The privacy page (/privacy): what happens to your words, from your
// computer to the model and the database, and how to get them back or
// delete them. In read mode, as the docs are (read-mode/page.tsx): the h1
// and its lede, the privacy line every upload shows, then the ten sections
// beside their index, and under the index a link to the docs, as the docs'
// index links here; on the other side, "In short", six of the sections'
// facts, each linking to its section.
import { createRoot } from "react-dom/client";
import { PRIVACY_LINE } from "@/lib/copy";
import { IN_SHORT, SECTIONS } from "./privacy/sections";
import { ReadPage } from "./read-mode/page";
import { P } from "./read-mode/prose";

createRoot(document.getElementById("app")!).render(
  <ReadPage
    title="Privacy"
    lede="What happens to your words: what leaves your computer, what the model sees, what's kept, and how to delete it."
    intro={<P>{PRIVACY_LINE}</P>}
    sections={SECTIONS}
    other={{ href: "/docs", label: "Read the docs" }}
    aside={{ title: "In short", links: IN_SHORT }}
  />,
);
