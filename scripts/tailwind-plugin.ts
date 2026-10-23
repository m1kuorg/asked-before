// Tailwind CSS v4 for Bun.build, on the installed tailwindcss (the
// bun-plugin-tailwind package bundles its own, older Tailwind). It takes the
// same steps as @tailwindcss/vite: compile a stylesheet that imports
// tailwindcss, scan the sources it names (and the project, minus what
// .gitignore leaves out, such as dist/), and build only the classes they use.
// Any other stylesheet passes through as it is.

import type { BunPlugin } from "bun";
import { dirname } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

export const tailwind = (root: string): BunPlugin => ({
  name: "tailwindcss",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
      const css = await Bun.file(path).text();
      if (!css.includes("tailwindcss")) return { contents: css, loader: "css" };
      const compiler = await compile(css, { base: dirname(path), from: path, onDependency: () => {}, shouldRewriteUrls: true });
      const auto = compiler.root === "none" ? [] : [{ base: compiler.root?.base ?? root, pattern: compiler.root?.pattern ?? "**/*", negated: false }];
      const scanner = new Scanner({ sources: [...auto, ...compiler.sources] });
      return { contents: compiler.build(scanner.scan()), loader: "css" };
    });
  },
});
