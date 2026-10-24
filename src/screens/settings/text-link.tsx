// A link inside a settings sentence to another page, such as Connect your
// AI or the privacy page: ink, underlined, darker on hover. An /app path is
// followed by the router; any other is a page of its own.

import type { ReactNode } from "react";

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-foreground underline underline-offset-4 decoration-input hover:decoration-foreground">
      {children}
    </a>
  );
}
