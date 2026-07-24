import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });
await cp("index.html", "dist/index.html");
await writeFile("dist/.nojekyll", "");

await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  outfile: "dist/assets/app.js",
  legalComments: "none",
  sourcemap: false,
});
