// The in-app not-found screen: any unmatched /app path, and any screen whose
// shelf, card, or upload answered 404 (notFound()). HTTP 200, as every /app
// path is.
import { useEffect } from "react";
import type { ScreenProps } from "@/app/router";
import { ButtonLink } from "@/components/ui/button";
import { NOT_FOUND_BODY, NOT_FOUND_TITLE } from "@/lib/copy";

export function NotFound({ setTitle }: ScreenProps) {
  useEffect(() => setTitle("Page not found"), [setTitle]);
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">{NOT_FOUND_TITLE}</h1>
      <p className="text-muted-foreground">{NOT_FOUND_BODY}</p>
      <ButtonLink variant="secondary" href="/app/desk">
        Go home
      </ButtonLink>
    </div>
  );
}
