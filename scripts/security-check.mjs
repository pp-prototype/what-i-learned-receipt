import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const textExtensions = new Set([
  ".html",
  ".js",
  ".mjs",
  ".json",
  ".md",
  ".sql",
  ".css",
  ".yml",
  ".yaml",
  "",
]);
const ignoredDirectories = new Set([".git", "node_modules", "dist"]);
const secretPatterns = [
  { name: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]+\b/ },
  { name: "Supabase service-role JWT", pattern: /\bservice_role\b[^.\n]*\beyJ[A-Za-z0-9_-]+\./i },
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

const files = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (textExtensions.has(extname(entry.name))) files.push(path);
  }
};

await walk(".");

const failures = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const secret of secretPatterns) {
    if (secret.pattern.test(content)) failures.push(`${file}: possible ${secret.name}`);
  }
}

const builtHtml = await readFile("dist/index.html", "utf8");
const builtApp = await readFile("dist/assets/app.js", "utf8");

if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(builtHtml)) {
  failures.push("dist/index.html: inline script weakens the Content Security Policy");
}
if (!builtHtml.includes("Content-Security-Policy")) {
  failures.push("dist/index.html: Content Security Policy is missing");
}
if (!builtHtml.includes('rel="noopener noreferrer"') && /target="_blank"/i.test(builtHtml)) {
  failures.push("dist/index.html: target=_blank link is missing rel=noopener noreferrer");
}
if (!builtApp.includes("captchaToken")) {
  failures.push("dist/assets/app.js: CAPTCHA token is not connected to authentication");
}
if (process.env.CI && builtApp.includes("1x00000000000000000000AA")) {
  failures.push("dist/assets/app.js: Cloudflare test key must not be deployed");
}

if (failures.length) {
  console.error(`Security check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Security check passed (${files.length} source files scanned).`);
