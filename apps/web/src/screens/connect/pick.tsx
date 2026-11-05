// Pick your agent: a radio group of the four agents, each a white card on
// the panel with its name and one line on what it sets up; the plugin first,
// marked Recommended, and picked to start with. Two cards across from a
// 32rem step, one under 32rem. A radio is named by the agent alone and
// described by the rest, and the picked card takes an ink edge. Arrow keys
// move the pick, as in any radio group. The app is light only, so the
// radio's dark-mode fill from shadcn is set back to the ground.

import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AGENTS, type Agent } from "./agents";

export function PickAgent({ agent, onPick }: { agent: Agent; onPick: (agent: Agent) => void }) {
  const id = useId();
  return (
    <RadioGroup
      aria-label="Your agent"
      value={agent.id}
      onValueChange={(value) => onPick(AGENTS.find((option) => option.id === value)!)}
      className="grid gap-2 @lg/step:grid-cols-2"
    >
      {AGENTS.map((option) => {
        const name = `${id}-${option.id}`;
        return (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-edge has-data-checked:border-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring pointer-coarse:min-h-11"
          >
            <RadioGroupItem value={option.id} aria-labelledby={`${name}-name`} aria-describedby={`${option.recommended ? `${name}-mark ` : ""}${name}-what`} className="mt-0.5 dark:bg-background" />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span id={`${name}-name`} className="text-sm font-medium">
                  {option.label}
                </span>
                {option.recommended && <Badge id={`${name}-mark`}>Recommended</Badge>}
              </span>
              <span id={`${name}-what`} className="text-sm text-muted-foreground">
                {option.description}
              </span>
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
