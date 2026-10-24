// A link inside a sentence, on any page: ink, underlined in the control
// grey, darker on hover. In the app, the router follows an /app path; any
// other is a page of its own.

import type { ComponentProps } from "react";

export function TextLink(props: Omit<ComponentProps<"a">, "className">) {
  return <a {...props} className="text-foreground underline underline-offset-4 decoration-input hover:decoration-foreground" />;
}
