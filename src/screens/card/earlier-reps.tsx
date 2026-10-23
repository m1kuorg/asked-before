// "Earlier cold reps": every checked cold rep on the card, newest first,
// with the day it was checked, its problem's first line, and Passed or Not
// yet. Your answers and the reasons stay out of it. Below 640px each row is
// two lines: the problem, then the day and the result.
import type { Rep } from "@asked-before/sdk";
import { cn } from "cn";
import { Time } from "@/components/time";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InlineText } from "@/screens/card/model-text";

export function EarlierReps({ reps, skill, className }: { reps: Rep[]; skill: string; className?: string }) {
  const checked = reps.filter((rep): rep is Rep & { checkedAt: string } => rep.verdict !== null && rep.checkedAt !== null).reverse();

  return (
    <section aria-labelledby="earlier-title" className={cn("flex flex-col gap-3", className)}>
      <h2 id="earlier-title" className="text-base font-semibold">
        Earlier cold reps
      </h2>
      {checked.length ? (
        <Table>
          <TableCaption className="sr-only">Every checked cold rep on {skill}, newest first</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="max-sm:hidden">Checked</TableHead>
              <TableHead>Problem</TableHead>
              <TableHead className="text-right max-sm:hidden">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checked.map((rep) => (
              <TableRow key={rep.id}>
                <TableCell className="text-muted-foreground tabular-nums max-sm:hidden">
                  <Time iso={rep.checkedAt} format="iso" />
                </TableCell>
                <TableCell className="w-full max-w-0">
                  <span className="block truncate">
                    <InlineText text={rep.problem.split("\n")[0] ?? ""} />
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground tabular-nums sm:hidden">
                    <Time iso={rep.checkedAt} format="iso" />
                    <Result verdict={rep.verdict} />
                  </span>
                </TableCell>
                <TableCell className="text-right max-sm:hidden">
                  <Result verdict={rep.verdict} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed border-edge px-4 py-2.5 text-sm text-muted-foreground">
          None yet. Each cold rep you finish on this card is listed here.
        </p>
      )}
    </section>
  );
}

function Result({ verdict }: { verdict: Rep["verdict"] }) {
  return verdict === "pass" ? <Badge variant="positive">Passed</Badge> : <Badge variant="negative">Not yet</Badge>;
}
