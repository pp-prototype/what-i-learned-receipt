import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const productionSiteKey = process.env.TURNSTILE_SITE_KEY?.trim();
const localTestSiteKey = "1x00000000000000000000AA";
const turnstileSiteKey = productionSiteKey || localTestSiteKey;

if (process.env.CI && !productionSiteKey) {
  throw new Error("TURNSTILE_SITE_KEY repository variable is required for a production build.");
}

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
  define: {
    TURNSTILE_SITE_KEY: JSON.stringify(turnstileSiteKey),
  },
  legalComments: "none",
  sourcemap: false,
});
