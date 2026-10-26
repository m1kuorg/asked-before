// The landing page (/): m1kuorg/basics#74, and the direction in
// .taste-skill/direction.json. The page itself is in ./landing/. No auth
// check, so no auth/me 401: the only request it can make is a guest sign-in,
// on a click.
import { createRoot } from "react-dom/client";
import { Landing } from "./landing/page";
import "./landing/landing.css";

createRoot(document.getElementById("app")!).render(<Landing />);
