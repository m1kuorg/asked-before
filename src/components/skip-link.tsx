// "Skip to content": the first stop on a page, out of sight until it takes
// focus, then a white pill at the top left. It goes to the page's
// <main id="main" tabIndex={-1}>, past the navigation.
import { cn } from "cn";

export function SkipLink({ className }: { className?: string }) {
  return (
    <a
      href="#main"
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:inline-flex focus:h-11 focus:items-center focus:rounded-lg focus:border focus:border-edge focus:bg-background focus:px-4 focus:text-sm focus:font-medium focus:text-foreground",
        className,
      )}
    >
      Skip to content
    </a>
  );
}
