// Under a list cut short: "Showing 10 of 23. The rest are on each shelf.",
// the second sentence a link to the shelves, where every card is. Home's
// Prove next, and the Roadmap's areas and its cards off the path, say it.

import { TextLink } from "@/components/text-link";
import { count } from "@/lib/format";

/** Nothing when `shown` is all `of` of them. */
export function Showing({ shown, of }: { shown: number; of: number }) {
  if (of <= shown) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Showing {count(shown)} of {count(of)}. <TextLink href="/app/shelves">The rest are on each shelf.</TextLink>
    </p>
  );
}
