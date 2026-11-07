import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Consumer dependency graph contract for #19310.
 *
 * npm does not apply a dependency's `overrides` block when that dependency is
 * installed into another project's tree, so every entry under `dependencies`
 * is resolved verbatim by consumers. `monaco-editor` pins `dompurify` to an
 * exact version (3.4.15 as of monaco-editor 0.57.0), which falls inside the
 * GHSA-cg2g-xh64-v4q7 affected range (>=3.4.4 <=3.4.16), so shipping it as a
 * runtime dependency re-introduces the affected copy into every fresh
 * consumer install no matter what the root `overrides` block says — a fresh
 * `npm install` of the published tarball resolves monaco-editor ->
 * dompurify@3.4.15 nested alongside the overridden 3.4.17 at the root.
 *
 * Both monaco packages are build-time-only: the SPA and the lib are prebuilt
 * into `build/` and `dist/` (see `files` in package.json), the CLI serves
 * those prebuilt assets instead of running Vite, and nothing in the shipped
 * runtime graph imports monaco from node_modules. They belong in
 * `devDependencies`, where consumers never resolve them.
 */
interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// Vitest runs with the project root as cwd (vite.config.ts lives at the repo
// root), so the manifest is read from there regardless of environment.
const manifestPath = join(process.cwd(), "package.json");
const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const buildOnlyMonacoPackages = ["monaco-editor", "@monaco-editor/react"];

describe("published consumer dependency graph (#19310)", () => {
  it.each(buildOnlyMonacoPackages)(
    "keeps %s out of the runtime dependency graph",
    (packageName) => {
      expect(manifest.dependencies?.[packageName]).toBeUndefined();
      expect(manifest.devDependencies?.[packageName]).toBeDefined();
    },
  );
});
