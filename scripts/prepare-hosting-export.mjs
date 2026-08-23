import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const rootDir = process.cwd();
const nextAppDir = join(rootDir, ".next", "server", "app");
const nextPagesDir = join(rootDir, ".next", "server", "pages");
const outDir = join(rootDir, "out");

const routeCopies = [
  { from: join(nextAppDir, "index.html"), to: join(outDir, "index.html") },
  { from: join(nextAppDir, "shop.html"), to: join(outDir, "shop", "index.html") },
  { from: join(nextAppDir, "checkout.html"), to: join(outDir, "checkout", "index.html") },
  { from: join(nextAppDir, "payment.html"), to: join(outDir, "payment", "index.html") },
  { from: join(nextAppDir, "contact.html"), to: join(outDir, "contact", "index.html") },
  { from: join(nextAppDir, "owner.html"), to: join(outDir, "owner", "index.html") },
  { from: join(nextAppDir, "owner", "messages.html"), to: join(outDir, "owner", "messages", "index.html") },
  { from: join(nextAppDir, "product.html"), to: join(outDir, "product", "index.html") },
  { from: join(nextAppDir, "robots.txt.body"), to: join(outDir, "robots.txt") },
  { from: join(nextAppDir, "sitemap.xml.body"), to: join(outDir, "sitemap.xml") },
  { from: join(nextPagesDir, "404.html"), to: join(outDir, "404.html") },
  { from: join(nextAppDir, "_not-found.html"), to: join(outDir, "404", "index.html") }
];

const legacyArtifactsToRemove = [
  join(outDir, "index.txt"),
  join(outDir, "shop", "index.txt"),
  join(outDir, "checkout", "index.txt"),
  join(outDir, "payment", "index.txt"),
  join(outDir, "contact", "index.txt"),
  join(outDir, "owner", "index.txt"),
  join(outDir, "owner", "messages", "index.txt"),
  join(outDir, "product", "index.txt"),
  join(outDir, "_next", "static", "development"),
  join(outDir, "_next", "static", "webpack")
];

for (const artifactPath of legacyArtifactsToRemove) {
  rmSync(artifactPath, { force: true, recursive: true });
}

for (const { from, to } of routeCopies) {
  if (!existsSync(from)) {
    throw new Error(`Missing export artifact: ${from}`);
  }

  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

console.log("Prepared hosting export in out/.");
